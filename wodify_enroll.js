const dotenv = require('dotenv').config();
const fs = require('fs');
const mailgunjs = require('mailgun-js');
const puppeteer = require('puppeteer');

const DEFAULT_POLL_PERIOD_SECONDS = 30;
const SCREENSHOT_FILE_PATH = 'enrolled.png';
const VIEW_HEIGHT = 768;
const VIEW_WIDTH = 1024;
const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];
const WODIFY_CALENDAR_TABLE_ID =
    'AthleteTheme_wt6_block_wtMainContent_wt9_wtClassTable';
const WODIFY_CALENDAR_CLASS_UNAVAILABLE_CLASS = 'icon-calendar--disabled';
const WODIFY_CALENDAR_CLASS_ALREADY_ENROLLED_CLASS = 'icon-ticket';
const WODIFY_CALENDAR_CLASS_ENROLL_CLASS = 'icon-calendar';
const WODIFY_CALENDAR_CLASS_FULL_SUBSTRING = 'waitlist';
const WODIFY_CALENDAR_URI =
    'https://app.wodify.com/Schedule/CalendarListView.aspx';
const WODIFY_BANNER_NOTIFICATION_ID =
    'AthleteTheme_wt6_block_RichWidgets_wt28_block_wtSanitizedHtml3';
const WODIFY_LOGIN_FORM_ID = 'form[id="FormLogin"]';
const WODIFY_LOGIN_PASSWORD_INPUT_ID = 'input[id="Input_Password"]';
const WODIFY_LOGIN_SUBMIT_BUTTON_ID = 'button[type="submit"]';
const WODIFY_LOGIN_URI = 'https://app.wodify.com/SignIn/Login';
const WODIFY_LOGIN_USERNAME_INPUT_ID = 'input[id="Input_UserName"]';

function log(message = '') {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function logIn(page, loginUri, config, credentials) {
  await page.goto(loginUri);
  await page.waitForSelector(config.formId);
  await page.type(config.usernameInputId, credentials.username);
  await page.type(config.passwordInputId, credentials.password);
  await page.click(config.submitButtonId);
  await page.waitForNavigation();
}

async function getDesiredOpenClasses(page, config) {
  return await page.evaluate((WEEKDAYS, config) => {
    const desiredClassWeekdays =
        Object.keys(config.enrollList).map(key => key.toLowerCase());
    let weekday = undefined;
    let desiredOpenClasses = [];
    const rows = document.querySelectorAll(`#${config.tableId} tr`);
    for (const row of rows) {
      const dateOrClassNameColumn = row.querySelector('td');
      if (dateOrClassNameColumn === null) continue;
      const newWeekday = WEEKDAYS.find(weekday => {
        return dateOrClassNameColumn.innerText.toLowerCase().includes(weekday);
      });
      if (newWeekday !== undefined) {
        weekday = newWeekday;
        continue;
      }
      if (!desiredClassWeekdays.includes(weekday)) continue;

      const columns = row.querySelectorAll('td');
      const [classColumn, reservationStatusColumn, enrollActionColumn,
          cancelActionColumn, programColumn, gymLocationColumn, startTimeColumn,
          durationColumn, coachColumn] = columns;

      const program = programColumn.innerText.toLowerCase();
      const gymLocation = gymLocationColumn.innerText.toLowerCase();
      const startTime = startTimeColumn.innerText.toLowerCase();

      const desiredStartTime = config.enrollList[weekday]['time'].toLowerCase();
      const desiredProgram =
          config.enrollList[weekday]['program'].toLowerCase();
      const desiredLocation =
          config.enrollList[weekday]['location'].toLowerCase();

      if (!(startTime.toLowerCase().includes(desiredStartTime) &&
            program.toLowerCase().includes(desiredProgram) &&
            gymLocation.toLowerCase().includes(desiredLocation))) {
        continue;
      }

      const column = enrollActionColumn;
      const unavailableSelector =
          `.${config.wodifyCalendarClassUnavailableClass}`;
      const alreadyEnrolledSelector =
          `.${config.wodifyCalendarClassAlreadyEnrolledClass}`;
      const enrollSelector = `.${config.wodifyCalendarClassEnrollClass}`;
      if (column.querySelector(unavailableSelector) !== null ||
          column.querySelector(alreadyEnrolledSelector) !== null ||
          column.querySelector(enrollSelector) === null) {
        continue;
      }

      const enrollAction = column.querySelector('a');
      if (enrollAction === null) {
        continue;
      }
      const classFull = enrollAction.title.toLowerCase().includes(
          config.wodifyCalendarClassFullSubstring);
      if (classFull) {
        continue
      }

      desiredOpenClasses.push({
        weekday: weekday,
        time: startTime,
        program: program,
        gymLocation: gymLocation,
        enrollActionId: enrollAction.id.toString(),
      });
    }
    return desiredOpenClasses;
  }, WEEKDAYS, config);
}

async function sendEmailNotification(mailgun, enrolledClasses, credentials) {
  const classPlurality = enrolledClasses.length == 1 ? '' : 'es';
  let message = `Registered in the following Wodify class${classPlurality}:\n`;
  enrolledClasses.forEach(enrolledClass => {
    message += `Time: ${capitalize(enrolledClass.weekday)} at ${
        enrolledClass.time.toUpperCase()}\n`;
    message += `Program: ${capitalize(enrolledClass.gymLocation)}\n`;
    message += `Location: ${capitalize(enrolledClass.program)}\n`;
  });
  message += '\n';
  message += `Verify your registration: ${WODIFY_CALENDAR_URI}`;
  const email = {
    from: `Wodify Class Notifier <postmaster@${credentials.domain}>`,
    to: credentials.recipient,
    subject: 'New Wodify class registration',
    text: message,
  };
  await mailgun.messages().send(email);
}

async function sendErrorEmailNotification(mailgun, error, credentials) {
  const email = {
    from: `Wodify Class Notifier <postmaster@${credentials.domain}>`,
    to: credentials.recipient,
    subject: 'Wodify class enroller failed',
    text: `Oh snap! Wodify Class Enroller encountered an error: ${error}`,
  };
  await mailgun.messages().send(email);
}

async function run(
    wodifyCredentials, mailgunCredentials, enrollList, pollPeriodSeconds,
    mailgun) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: VIEW_WIDTH, height: VIEW_HEIGHT});

  const loginConfig = {
    formId: WODIFY_LOGIN_FORM_ID,
    usernameInputId: WODIFY_LOGIN_USERNAME_INPUT_ID,
    passwordInputId: WODIFY_LOGIN_PASSWORD_INPUT_ID,
    submitButtonId: WODIFY_LOGIN_SUBMIT_BUTTON_ID,
  };
  log('Logging into Wodify...');
  await logIn(page, WODIFY_LOGIN_URI, loginConfig, wodifyCredentials);
  log('Logged in.');

  let firstVisit = true;
  const waitOptions = {waitUntil: ['networkidle0', 'domcontentloaded']};
  const enrollConfig = {
    tableId: WODIFY_CALENDAR_TABLE_ID,
    weekdays: WEEKDAYS,
    wodifyCalendarClassUnavailableClass:
        WODIFY_CALENDAR_CLASS_UNAVAILABLE_CLASS,
    wodifyCalendarClassAlreadyEnrolledClass:
        WODIFY_CALENDAR_CLASS_ALREADY_ENROLLED_CLASS,
    wodifyCalendarClassEnrollClass: WODIFY_CALENDAR_CLASS_ENROLL_CLASS,
    wodifyCalendarClassFullSubstring: WODIFY_CALENDAR_CLASS_FULL_SUBSTRING,
    enrollList: enrollList,
  };

  while (true) {
    let startTime = new Date().getTime();

    if (firstVisit) {
      await page.goto(WODIFY_CALENDAR_URI, waitOptions);
    } else {
      await page.reload(waitOptions);
    }
    firstVisit = false;

    log('Checking for available classes...');
    const desiredOpenClasses = await getDesiredOpenClasses(page, enrollConfig);
    if (0 < desiredOpenClasses.length) {
      log(`${desiredOpenClasses.length} desired class(es) available.`);
    } else {
      log('No desired classes available.')
    }
    for (const desiredClass of desiredOpenClasses) {
      log(`Attempting to enroll in ${desiredClass.weekday}'s ${
          desiredClass.time} ${desiredClass.program} class in ${
          desiredClass.gymLocation}...`);
      await page.click(`#${desiredClass.enrollActionId}`);
      await page.waitForSelector(`#${WODIFY_BANNER_NOTIFICATION_ID}`);
    }
    if (0 < desiredOpenClasses.length) {
      log('Finished attemting to enroll in all open classes.');
      await page.screenshot({path: SCREENSHOT_FILE_PATH, fullPage: true});
    }

    if (mailgun !== undefined && 0 < desiredOpenClasses.length) {
      log('Sending email notification...');
      try {
        await sendEmailNotification(
            mailgun, desiredOpenClasses, mailgunCredentials);
        log('Sent email notification.');
      } catch (error) {
        log(`Failed to send email notification: ${error}`);
      }
    }

    const elapsedTime = new Date().getTime() - startTime;
    const millisecondsUntilNextCheck = pollPeriodSeconds * 1000 - elapsedTime;
    log(`Waiting ${
        millisecondsUntilNextCheck /
        1000} seconds to check class availability again.`);
    await new Promise(
        resolve => {setTimeout(resolve, millisecondsUntilNextCheck)});
  }

  await browser.close();
}

(async () => {
  const args = process.argv;
  const usage = `Usage: ${args[0]} ${args[1]} <enroll_list.json>`
  if (args.length != 3) {
    console.log(usage);
    process.exit(1);
  }
  const helpArg = args[2].toLowerCase();
  if (helpArg === 'help' || helpArg === '--help' || helpArg === '-h') {
    console.log(usage);
    process.exit(0);
  }
  const enrollListFile = args[2];

  const wodifyUsername = process.env.WODIFY_USERNAME;
  const wodifyPassword = process.env.WODIFY_PASSWORD;
  const emailNotificationRecipient = process.env.EMAIL_NOTIFICATION_RECIPIENT;
  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const pollPeriodSeconds =
      process.env.POLL_PERIOD_SECONDS || DEFAULT_POLL_PERIOD_SECONDS;

  const enrollList = JSON.parse(fs.readFileSync(enrollListFile));

  if (wodifyUsername === undefined) {
    throw new Error('Missing Wodify username.');
  }
  if (wodifyPassword === undefined) {
    throw new Error('Missing Wodify password.');
  }
  const wodifyCredentials = {
    username: wodifyUsername,
    password: wodifyPassword,
  };

  if (emailNotificationRecipient === undefined) {
    log('Warning: Missing an email notification recipient. No email notification will be sent.');
  } else {
    if (mailgunApiKey === undefined) {
      throw new Error(
          'Missing Mailgun API key. No email notification will be sent.');
    }
    if (mailgunDomain === undefined) {
      throw new Error(
          'Missing Mailgun domain. No email notification will be sent.');
    }
  }
  const mailgunCredentials = {
    recipient: emailNotificationRecipient,
    apiKey: mailgunApiKey,
    domain: mailgunDomain,
  };
  const mailgun = (() => {
    if (emailNotificationRecipient === undefined ||
        mailgunApiKey === undefined || mailgunDomain === undefined) {
      return undefined;
    }
    return mailgunjs({
      apiKey: mailgunCredentials.apiKey,
      domain: mailgunCredentials.domain,
    });
  })();


  try {
    run(wodifyCredentials, mailgunCredentials, enrollList, pollPeriodSeconds,
        mailgun);
  } catch (error) {
    sendErrorEmailNotification(mailgun, error, mailgunCredentials);
  }
})();
