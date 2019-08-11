'use strict';

const timezone = require('./timezone.json')
var dateFormat = require('dateformat');

// The date object will still show other timezone
Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}

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

function getLocalTime(date, client_timezone) {
  var my_offset = -date.getTimezoneOffset() / 60
  var client_offset = timezone[client_timezone]
  date = date.addHours(client_offset - my_offset)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0 ,0)
}

// Maybe check task types?
async function showDueActivities(conv, params, option, tasks = true) {
  var activities = {}
  if (tasks)
    activities = await wrike_api.getTasks(conv.user.access.token, {'dueDate': ['end']})
  else
    activities = await wrike_api.getFolderTree(conv.user.access.token, {'updatedDate': ["start", "end"]})
  var user = await wrike_api.getCurrentUser(conv.user.access.token)

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


  // conv.add(date_limit.toString())
  var project_count = 0
  activities.forEach((folder) => {
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
        if(parseInt(days) == 0) days_remained = 'no time'
        var task_due = dateFormat(new Date(due), "yyyy-mm-dd");
        conv.add(folder.title + ': ' + task_due + ' (' + days_remained + 'remained)')
        project_count = project_count + 1
      }
    }
  })
  if (project_count == 0) {
    conv.add("There are no deadlines in that interval")
  }
}

module.exports = {
  showProjectFolders: async function(conv, params, option) {
    var folders = await wrike_api.getFolderTree(conv.user.access.token)
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
    // conv.ask(new Suggestions(["Saab"]))
  },
  showDueProjects: async function(conv, params, option) {
    return showDueActivities(conv, params, option, false)
  },
  showDueTasks: async function(conv, params, option) {
    return showDueActivities(conv, params, option, true)
  },
  setTaskName: async function(conv, params, name) {
    conv.contexts.set(conv.contexts.set('task-context', 5, {'name': name}));

    conv.add("Add a task description now")
  },
  setTaskDescription: async function(conv, params, description) {
    var context_params = conv.contexts.get('task-context').parameters
    context_params['description'] = description
    conv.contexts.set(conv.contexts.set('task-context', 5, context_params));

    conv.add("Who should be responsable for this task?")
    var users = await wrike_api.getContacts(conv.user.access.token)
    var usernames = []
    users.forEach((user) => {
      if(user.type === 'Person') usernames.push(user.firstName + ' ' + user.lastName)
    })
    conv.add(new Suggestions(usernames))
  },
  setTaskResponsable: async function(conv, params, responsable) {
    var users = await wrike_api.getContacts(conv.user.access.token)
    var userid = ''
    users.forEach((user) => {
      if ((user.firstName + ' ' + user.lastName).toLowerCase() === responsable.toLowerCase() || (user.lastName + ' ' + user.firstName).toLowerCase() === responsable.toLowerCase()) {
        userid = user.id
      }
    })

    if(userid !== '') {
      var context_params = conv.contexts.get('task-context').parameters
      context_params['responsable'] = userid
      conv.contexts.set(conv.contexts.set('task-context', 5, context_params));
      conv.add('Where should this task be placed?')
      var folders = await wrike_api.getFolderTree(conv.user.access.token)
      var foldernames = []
      folders.forEach((folder) => {
        if(folder.scope === 'WsFolder') foldernames.push(folder.title)
      })
      conv.add(new Suggestions(foldernames))
    }
    else {
      conv.contexts.set(conv.contexts.set('description-followup', 1, context_params));
      conv.add('There is no such person, try again')
      var users = await wrike_api.getContacts(conv.user.access.token)
      var usernames = []
      users.forEach((user) => {
        if(user.type === 'Person') usernames.push(user.firstName + ' ' + user.lastName)
      })
      conv.add(new Suggestions(usernames))
    }
  },
  setTaskProject: async function(conv, params, project_name) {
    var projects = await wrike_api.getFolderTree(conv.user.access.token)

    var task_project = ''
    projects.forEach((project) => {
      if (project.title === project_name) {
        task_project = project.id
      }
    })

    if (task_project !== '') {
      var context_params = conv.contexts.get('task-context').parameters
      context_params['project'] = task_project
      conv.contexts.set(conv.contexts.set('task-context', 5, context_params));

      conv.add('If there is a deadline set it now')
    }
    else {
      var folders = await wrike_api.getFolderTree(conv.user.access.token)
      var foldernames = []
      folders.forEach((folder) => {
        if(folder.scope === 'WsFolder') foldernames.push(folder.title)
      })
      conv.add(new Suggestions(foldernames))
      conv.add('There is no such project, try again')
    }
  },

  setTaskWithoutDeadline: async function(conv, params, options) {
    var context_params = conv.contexts.get('task-context').parameters
    var task_name = context_params['name']
    var task_description = context_params['description']
    var task_responsable = context_params['responsable']
    var task_folder = context_params['project']
    await wrike_api.createTask(conv.user.access.token, task_name, task_description, task_responsable, task_folder)
    conv.add('Task created without deadline')
  },

  setTaskDueDate: async function(conv, params, options) {
    var task_due = ''
    if(params['date'] !== '') {
      task_due = new Date(params['date'])
    }
    else if (params['date-period'] !== '') {
      task_due = new Date(params['date-period']['endDate'])
    }
    var context_params = conv.contexts.get('task-context').parameters
    var task_name = context_params['name']
    var task_description = context_params['description']
    var task_responsable = context_params['responsable']
    var task_folder = context_params['project']
    if (task_due !== '') {
      var task_due = dateFormat(task_due, "yyyy-mm-dd");
      await wrike_api.createTask(conv.user.access.token, task_name, task_description, task_responsable, task_folder, task_due)
      conv.add('Task created')
    }
    else {
      await wrike_api.createTask(conv.user.access.token, task_name, task_description, task_responsable, task_folder)
      conv.add('No deadline')
    }
  }
}
