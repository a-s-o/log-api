# log-api
Sample log API using Koa, kafka and postgres


## Requirements

Docker is used internally to run zookeeper, kafka and postgres. Docker must be accessible locally via the command line as `docker` and via the remote API.

See [Docker documentation](https://docs.docker.com/) for how to install on your platform.

## Installation

Clone the repository

    > git clone https://github.com/a-s-o/log-api.git
    > cd log-api

Install and start using:

    > npm install
    > npm start

> By default an http server is started on port specified as `main.port` the `config.js` (default: `3000`)

To run the tests use:

    > npm test

To run code coverage reports:

    > npm run coverage

To uninstall:

    > npm run destroy


# API

The following endpoints are available to use:

## POST `/log`

Creates a log entry

Request body (json):
```
actionId: string().min(3).required()
userId: string().guid().optional()
data: any()
```

Response (json):
```
result: {
    actionId: string()
    actionTime: date()
    _kafka: {
        topic: string()
        offset: number()
        partition: number()
    }
}
```

### POST `/classes/user`

Creates a user who can then post log entries

Request body (json):
```
email: string().email().required()
name: string().required()
password: string().min(8).required()
```

Response (json):
```
result: {
    id: string()
    email: string().email()
    name: string()
}
```

### PUT `/classes/user/:id`

Update an existing user's information

Params:
```
id: string().guid()
```

Request body (json):
```
name: string()
password: string().min(8)
```

Response (json):
```
result: {
    id: string().guid()
    email: string().email()
    name: string()
}
```
