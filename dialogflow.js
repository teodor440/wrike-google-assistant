'use strict';

var timezone = require('./timezone.json')
var dateFormat = require('dateformat');

const wrike_api = require('./wrike_api.js')
const {
  Image,
  Suggestions,
  BasicCard,
  SimpleResponse,
  LinkOutSuggestion,
  List,
  BrowseCarousel,
  BrowseCarouselItem
} = require('actions-on-google');

// The date object will still show other timezone
Date.prototype.addHours= function(hours){
    var copiedDate = new Date(this.getTime());
    copiedDate.setHours(copiedDate.getHours() + hours);
    return copiedDate
}

// User time reported to registered timezone in Wrike
function getLocalTime(date, client_timezone) {
  var my_offset = -date.getTimezoneOffset() / 60
  var client_offset = timezone[client_timezone]
  date = date.addHours(client_offset - my_offset)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0 ,0)
}

// Suggestions for user to click
async function getFolderSuggestions(token) {
  var folders = await wrike_api.getFolderTree(token)
  var foldernames = []
  folders.forEach((folder) => {
    if(folder.scope === 'WsFolder') foldernames.push(folder.title)
  })
  return new Suggestions(foldernames)
}

async function getUserSuggestions(token) {
  var users = await wrike_api.getContacts(token)
  var usernames = []
  users.forEach((user) => {
    if(user.type === 'Person') usernames.push(user.firstName + ' ' + user.lastName)
  })
  return new Suggestions(usernames);
}

// Parameters from context
// It helps build the answer to show the client the details about the task he is creating
function getTaskChecklist(parameters) {
  var items = {
    'create_task': {title: 'Create task'},
    'name': {title: 'Task name', description:parameters['name']},
    'description': {title: 'Task description', description:parameters['description']},
    'responsible': {title: (typeof parameters['responsible'] !== 'undefined') ? 'Task responsible' : 'Add a task responsible', description:parameters['responsible_name']},
    'project': {title: (typeof parameters['project_name'] !== 'undefined') ? 'Task project' : 'Add task to a project', description:parameters['project_name']},
    'start': {title: (typeof parameters['start'] !== 'undefined') ? 'Task start time' : 'Add starting time', description:parameters['start']},
    'due': {title: (typeof parameters['due'] !== 'undefined') ? 'Task due' : 'Add a deadline', description:parameters['due']},
  }
  return new List({title: 'Task details', items:items})
}

// Maybe check task types?
async function showDueActivities(conv, params, option, tasks = true) {
  var activities = {}
  try {
    if (tasks) {
      activities = await wrike_api.getTasks(conv.user.access.token)
    }
    else {
      activities = await wrike_api.getFolderTree(conv.user.access.token, '?project=true')
    }
    var user = await wrike_api.getCurrentUser(conv.user.access.token)
  }
  catch(err) {
    conv.add('Sorry, a server connection error occured')
    console.log(err)
    return
  }

  var client_date = getLocalTime(new Date(), user.timezone)
  var date_limit = {}
  if(params['date'] !== '') {
    date_limit = getLocalTime(new Date(params['date']), user.timezone)
  }
  else if (params['date-period'] !== '') {
    date_limit = getLocalTime(new Date(params['date-period']['endDate']), user.timezone)
  }
  else {
    date_limit = new Date(client_date.toString())
    // The projects this week
    date_limit.addHours(168)
  }

  var project_count = 0
  activities.forEach((folder) => {
    // Filter for completed projects
    if(folder['status'] === 'Completed' || folder['status'] === 'Cancelled') return
    if(typeof folder['project'] !== 'undefined' && typeof folder['project']['completedDate'] !== 'undefined') return
    // startDate
    var due = ''
    if(tasks && typeof folder['dates'] !== 'undefined' && typeof folder.dates['due'] !== 'undefined') {
      due = folder.dates.due
    }
    if(tasks === false && typeof folder['project'] !== 'undefined' && typeof folder.project['endDate'] !== 'undefined') {
      due = folder.project.endDate
    }
    if(due !== '') {
      let endDate = new Date(due)
      if (endDate <= date_limit && endDate >= client_date) {
        let days = Math.abs(endDate - client_date) / 86400000
        let days_remained = parseInt(days) + ' days '
        if(parseInt(days) === 1) days_remained = 'one day '
        if(parseInt(days) == 0) days_remained = 'no time '
        var task_due = dateFormat(endDate, "yyyy-mm-dd");
        conv.add(folder.title + ': ' + task_due + ' (' + days_remained + 'remained)')
        project_count = project_count + 1
      }
    }
  })
  if (project_count == 0) {
    conv.add("There are no deadlines in that interval")
  }
}

// Functions that are delegated to fulfill intents
module.exports = {
  // It is here due to historical reasons, but maybe you'd like to enable it
  showProjectFolders: async function(conv, params, option) {
    try {
      var folders = await wrike_api.getFolderTree(conv.user.access.token)
    }
    catch(err) {
      conv.add('Sorry, a server connection error occured')
      console.log(err)
      return
    }

    var listParams = {title: "title", items: {}}

    // Get the folder
    var children = []
    var id = option
    var name = 'Root'
    if (conv.action === '')
      id = ''
    else
      name = ''

    for(let index = 0; index < folders.length; index++)
      if (folders[index].id === id || folders[index].title === name) {
        children = folders[index].childIds

        break
      }

    folders.forEach((folder) => {
        if (children.includes(folder.id)) {
          let id = folder['id']
          let name = folder['title']
          listParams.items[id] = {}
          listParams.items[id]['title'] = name
        }
      })
    conv.add("Click on a folder to see its subprojects")
    conv.add(new List(listParams))
  },

  showDueProjects: async function(conv, params, option) {
    return showDueActivities(conv, params, option, false)
  },

  showDueTasks: async function(conv, params, option) {
    return showDueActivities(conv, params, option, true)
  },


  setTaskName: async function(conv, params, name) {
    var context_params = {
      'name': name,
      'description': '',
      'responsible': '',
      'project': '',
      'start': '',
      'due': ''
    }
    conv.contexts.set(conv.contexts.set('task-context', 5, context_params));

    conv.add("Add a task description now")
  },

  setTaskDescription: async function(conv, params, description) {
    var context_params = conv.contexts.get('task-context').parameters
    context_params['description'] = description
    conv.contexts.set(conv.contexts.set('task-context', 5, context_params));

    try {
      var folder_suggestions = await getFolderSuggestions(conv.user.access.token)
    }
    catch(err) {
      conv.add('Sorry, a server connection error occured')
      console.log(err)
      return
    }

    conv.add('Where should this task be placed?')
    conv.add(folder_suggestions)
  },

  setTaskProject: async function(conv, params, project_name) {
    try {
      var projects = await wrike_api.getFolderTree(conv.user.access.token)
    }
    catch(err) {
      conv.add('Sorry, a server connection error occured')
      console.log(err)
      return
    }

    var task_project = ''
    projects.forEach((project) => {
      if (project.title.toLowerCase() === project_name.toLowerCase()) {
        task_project = project.id
      }
    })

    if (task_project !== '') {
      var context_params = conv.contexts.get('task-context').parameters
      context_params['project'] = task_project
      context_params['project_name'] = project_name
      conv.contexts.set('task-context', 5, context_params);

      if (conv. intent === 'Task folder assigning') {
        conv.add('Would you like to add or change details about this task?')
        conv.add(getTaskChecklist(context_params))
      }
      else if (conv.intent === 'Option changing') {
        conv.contexts.set('Taskfolderassigning-followup', 1)
        conv.add('Parent folder changed to ' + project_name)
      }
    }
    else {
      try {
        var folder_suggestions = await getFolderSuggestions(conv.user.access.token)
      }
      catch(err) {
        conv.add('Sorry, a server connection error occured')
        console.log(err)
        return
      }
      conv.add(folder_suggestions)
      conv.add('There is no such project, try again')
      // Change text depending on the intent
      if (conv.intent === 'Task folder assigning') conv.contexts.set('taskdescribing-followup', 1)
      else if (conv.intent === 'Option chaning') conv.contexts.set('Changeoption-followup', 1)
    }
  },

  // Create task from context parameters
  createTask: async function(conv, params, options) {
    var context_params = conv.contexts.get('task-context').parameters
    var task_name = context_params['name']
    var task_description = context_params['description']
    var task_responsible = context_params['responsible']
    var task_folder = context_params['project']
    var task_start = context_params['start']
    var task_due = context_params['due']

    try {
      await wrike_api.createTask(conv.user.access.token, task_name, task_description, task_responsible, task_folder, task_start, task_due)
    }
    catch(err) {
      conv.add('Sorry, a server connection error occured')
      conv.contexts.set('Taskfolderassigning-followup', 1)
      console.log(err)
      return
    }
    conv.add('Task created sucessfully')
  },

  // Here the user is shown the parameters entered for the task and is asked if wants to do further modifications
  checkTask: async function(conv, params, options) {
    var context_params = conv.contexts.get('task-context').parameters
    var task_name = context_params['name']
    var task_description = context_params['description']
    var task_responsible = context_params['responsible']
    var task_folder = context_params['project']
    var task_start = context_params['start']
    var task_due = context_params['due']

    var to_update = ''
    if (params['TaskProperty'] !== '') to_update = params['TaskProperty']
    else to_update = options

    if (['name', 'description', 'responsible', 'project', 'start', 'due'].includes(to_update)) {
      var context_params = conv.contexts.get('task-context').parameters
      context_params['to_update'] = to_update
      conv.contexts.set('task-context', 5, context_params);

      var to_update_formatted = {
        'name': 'task name',
        'description': 'description',
        'responsible': 'person assigned',
        'project': 'parent folder',
        'start': 'beggining period',
        'due': 'deadline'
      }
      conv.add('Ok, tell me the new ' + to_update_formatted[to_update])
      // Give user suggestions
      if (to_update === 'project') {
        try {
          var suggestions = await getFolderSuggestions(conv.user.access.token)
        }
        catch(err) {
          conv.add('Sorry, a server connection error occured')
          conv.contexts.set('Taskfolderassigning-followup', 1)
          console.log(err)
          return
        }
        conv.add(suggestions)
      }
      else if (to_update === 'responsible'){
        try {
          var suggestions = await getUserSuggestions(conv.user.access.token)
        }
        catch(err) {
          conv.add('Sorry, a server connection error occured')
          conv.contexts.set('Taskfolderassigning-followup', 1)
          console.log(err)
          return
        }
        conv.add(suggestions)
      }
      // Next to changing options
      conv.contexts.set('Changeoption-followup', 1)
    }
    else if (to_update === 'create_task') {
      try {
        await module.exports.createTask(conv, params, options)
      }
      catch(err) {
        conv.add('Sorry, a server connection error occured')
        conv.contexts.set('Taskfolderassigning-followup', 1)
        console.log(err)
        return
      }
    }
    // If the user didn't parse the parameter (parameters cannot be made mandatory in dialogflow without two separate functions for this intent)
    else {
      conv.contexts.set('Taskfolderassigning-followup', 1)
      conv.add('Sorry, I didn\'t catch that, do you want to create or modify the task?')
    }
  },

  // At this stage the user is queried about requested parameter changes
  // Keeps context alive in case of user input problems
  changeTask: async function(conv, params, text) {
    var context_params = conv.contexts.get('task-context').parameters
    var to_update = context_params['to_update']
    // NAME AND DESCRIPTION
    if (to_update === 'name' || to_update === 'description') {
      context_params[to_update] = text
      conv.contexts.set('Taskfolderassigning-followup', 1)
    }
    // RESPONSIBLE
    else if (to_update === 'responsible') {
      try {
        var users = await wrike_api.getContacts(conv.user.access.token)
      }
      catch(err) {
        conv.add('Sorry, a server connection error occured')
        conv.contexts.set('Taskfolderassigning-followup', 1)
        console.log(err)
        return
      }
      var responsible = text
      var userid = ''
      users.forEach((user) => {
        if ((user.firstName + ' ' + user.lastName).toLowerCase() === responsible.toLowerCase() || (user.lastName + ' ' + user.firstName).toLowerCase() === responsible.toLowerCase()) {
          userid = user.id
        }
      })
      if(userid !== '') {
        var context_params = conv.contexts.get('task-context').parameters
        context_params['responsible'] = userid
        context_params['responsible_name'] = responsible
        conv.contexts.set('task-context', 5, context_params);
        conv.add('Responsible changed to ' + responsible)
        // Back to showing task details
        conv.contexts.set('Taskfolderassigning-followup', 1)
      }
      else {
        conv.add('There is no such person, try again')
        try {
          var user_suggestions = await getUserSuggestions(conv.user.access.token)
        }
        catch(err) {
          conv.add('Sorry, a server connection error occured')
          conv.contexts.set('Taskfolderassigning-followup', 1)
          console.log(err)
          return
        }

        conv.add(user_suggestions)
        // Try again
        conv.contexts.set('Changeoption-followup', 1)
      }
    }
    // PROJECT
    else if (to_update === 'project') {
      try {
        await module.exports.setTaskProject(conv, params, text)
      }
      catch(err) {
        conv.add('Sorry, a server connection error occured')
        conv.contexts.set('Taskfolderassigning-followup', 1)
        console.log(err)
        return
      }
    }
    // START
    else if (to_update === 'start') {
      var date = undefined
      if (params['date'] !== '') date = new Date(params['date'])
      else if (params['date-period'] != '') {
        if (params['date-period']['endDate'] != '') date = new Date(params['date-period']['endDate'])
        if (params['date-period']['startDate'] != '') date = new Date(params['date-period']['startDate'])
      }
      else {
        conv.add('Sorry, couldn\'t set up the beginning date')
      }
      if(typeof date !== 'undefined') var task_start = dateFormat(date, "yyyy-mm-dd");

      var context_params = conv.contexts.get('task-context').parameters
      context_params['start'] = task_start
      conv.contexts.set('task-context', 5, context_params);
      conv.contexts.set('Taskfolderassigning-followup', 1)
    }
    // DUE
    else if (to_update === 'due') {
      var date = undefined
      if (params['date'] !== '') date = new Date(params['date'])
      else if (params['date-period'] != '') {
        if (params['date-period']['startDate'] != '') date = new Date(params['date-period']['startDate'])
        if (params['date-period']['endDate'] != '') date = new Date(params['date-period']['endDate'])
      }
      else {
        conv.add('Sorry, we couldn\'t set up the deadline')
      }
      if(typeof date !== 'undefined') var task_due = dateFormat(date, "yyyy-mm-dd");

      var context_params = conv.contexts.get('task-context').parameters
      context_params['due'] = task_due
      conv.contexts.set('task-context', 5, context_params);
      conv.contexts.set('Taskfolderassigning-followup', 1)
    }
    else {
      conv.add('Sorry, something went wrong, would you like to create the task as it is or try to modify again a value?')

      return
    }
    conv.ask('Would you like to add further modifications?')
    conv.add(getTaskChecklist(context_params))
  },
}
