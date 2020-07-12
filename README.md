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

# Optionally receive email notifications after enrolling in a class
EMAIL_NOTIFICATION_RECIPIENT="someone@example.com"
MAILGUN_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxx"
MAILGUN_DOMAIN="example.com"

# Optionally tune the polling period (default = 30 seconds)
POLL_PERIOD_SECONDS=30
```

### Enroll list
Specify the classes in which you wish to enroll. The weekday keys should be
written in lowercase. The `location`, `program`, and `time` values must match
the text in Wodify's calendar but are case-insensitive.

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
