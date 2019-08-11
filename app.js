'use strict';

// Redirect
var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(301,{Location: 'https://' + req.headers.host + req.url})
  res.end()
}).listen(8000)

// Actual server
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('./certificates/key.key'),
  cert: fs.readFileSync('./certificates/cert.pem')
};

// init project pkgs
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const server = express().use(bodyParser.json())
const dialog = require('./dialogflow')
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

assistant.intent('Show projects', dialog.showProjectFolders)
assistant.intent('Project selected', dialog.showProjectFolders)
assistant.intent('Show due projects', dialog.showDueProjects)
assistant.intent('Show due tasks', dialog.showDueTasks)
assistant.intent('Name', dialog.setTaskName)
assistant.intent('Description', dialog.setTaskDescription)
assistant.intent('Responsable', dialog.setTaskResponsable)
assistant.intent('Project', dialog.setTaskProject)
assistant.intent('Deadline', dialog.setTaskDueDate)
assistant.intent('Create without deadline', dialog.setTaskWithoutDeadline)
// INTENTS MANAGED

server.get('/', function(req, res) {
  res.write("Webhook for google assistant")
  res.end()
});

// server.post('/', assistant);
server.post('/fullfilment', (req, res, next) => {
  assistant(req, res, next)
})

https.createServer(options, server).listen(8080)
