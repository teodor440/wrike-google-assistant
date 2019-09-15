'use strict';

// init project pkgs
const express = require('express')
const https = require('https');
const request = require('request')
const bodyParser = require('body-parser')
const server = express().use(bodyParser.json())
const dialog = require('./dialogflow')
const fs = require('fs');
const port = 8080;

// MANAGE INTENTS
// Import the appropriate service and chosen wrappers
const {
  dialogflow,
  actionssdk,
  SignIn,
} = require('actions-on-google')

// Create an app instance
const assistant = dialogflow({
  clientId: '1gJeV0Ey',
});

// Project showing is not a concern anymore
// assistant.intent('Show projects', dialog.showProjectFolders)
// assistant.intent('Project selected', dialog.showProjectFolders)
assistant.intent('Show due projects', dialog.showDueProjects)
assistant.intent('Show due tasks', dialog.showDueTasks)
// Intents for task creation
assistant.intent('Task naming', dialog.setTaskName)
assistant.intent('Task describing', dialog.setTaskDescription)
assistant.intent('Task folder assigning', dialog.setTaskProject)
assistant.intent('Change task option', dialog.checkTask)
assistant.intent('Task option changing', dialog.changeTask)
assistant.intent('Task creation intent', dialog.createTask)
assistant.intent('Adjust date for task', dialog.changeTask)
// Intents for project creation
assistant.intent('Project naming', dialog.setProjectName)
assistant.intent('Project describing', dialog.setProjectDescription)
assistant.intent('Project folder assigning', dialog.setProjectFolder)
assistant.intent('Change project option', dialog.checkProject)
assistant.intent('Project option changing', dialog.changeProject)
assistant.intent('Project creation intent', dialog.createProject)
assistant.intent('Adjust date for project', dialog.changeProject)
// INTENTS MANAGED

server.post('/fullfilment', (req, res, next) => {
  assistant(req, res, next)
})

const options = {
  key: fs.readFileSync('./certificates/key.key'),
  cert: fs.readFileSync('./certificates/cert.pem')
};

https.createServer(options, server).listen(port)
