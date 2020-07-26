# Wodify Enroll
Automatically enroll in Wodify classes.

## Run
```bash
$ npm install
$ node wodify_enroll --help
Usage: node wodify_enroll <enroll_list.json>
$ node wodify_enroll enroll_list.json
```

## Setup
### Environment variables
Configure Wodify Enroll using the following environment variables.

```bash
.env

# Required
WODIFY_USERNAME="username"
WODIFY_PASSWORD="password"
ENROLLMENT_OPENING_BEFORE_CLASS_MINUTES=4320

# Optionally receive email notifications after enrolling in a class
EMAIL_NOTIFICATION_RECIPIENT="someone@example.com"
MAILGUN_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxx"
MAILGUN_DOMAIN="example.com"

# Tune the polling period (default = 60 seconds) to check class availability
POLL_PERIOD_SECONDS=60

# Tune the reset period (default = 3600 seconds) to reset the filters
RESET_PERIOD_SECONDS=3600

# Tune the interval around the the desired class time to poll continuously
# (default = 300 seconds)
CONTINUOUS_POLL_BEFORE_DESIRED_CLASS_SECONDS=300
CONTINUOUS_POLL_AFTER_DESIRED_CLASS_SECONDS=300
```

### Enroll list
Specify the classes in which you wish to enroll. The weekday keys should be
written in lowercase. The `location`, `program`, and `time` keys' values must
match the text in Wodify's calendar but are case-insensitive.

Note: Wodify Enroll assumes that the host machine is in the same timezone as
the desired classes.

```json
enroll_list.json

{
  "monday": {
    "location": "redmond",
    "program": "sasquatch",
    "time": "6:00 pm"
  },
  "tuesday": {
    "location": "redmond",
    "program": "sasquatch",
    "time": "6:00 pm"
  },
  "wednesday": {
    "location": "redmond",
    "program": "sasquatch",
    "time": "6:00 pm"
  },
  "thursday": {
    "location": "redmond",
    "program": "sasquatch",
    "time": "6:00 pm"
  },
  "friday": {
    "location": "redmond",
    "program": "sasquatch",
    "time": "6:00 pm"
  },
  "saturday": {
    "location": "redmond",
    "program": "sasquatch",
    "time": "9:00 am"
  }
}
```
