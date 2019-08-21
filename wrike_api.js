'use strict';

const https = require('https')
const axios = require('axios')

// In the future there might be a need for custom queries
async function get(path, token, additional_parameters) {
  if(typeof additional_parameters !== 'undefined')
    path += additional_parameters

  var data = await axios.get(path, {
    headers: {
      Authorization: 'bearer ' + token
    },
  })

  return data['data']['data']
}

module.exports = {
  getFolderTree: async function(token, additional_parameters) {
    return get('https://www.wrike.com/api/v4/folders', token, additional_parameters)
  },

  getFoldersInfo: async function(token, foldersID_array) {
    var foldersID_string = '/'
    foldersID_array.forEach((folder) => {
      foldersID_string += folder + ','
    })
    foldersID_string = foldersID_string.slice(0, -1)

    return get('https://www.wrike.com/api/v4/folders', token, foldersID_string)
  },

  getContacts: async function(token, additional_parameters) {
    return get('https://www.wrike.com/api/v4/contacts', token, additional_parameters)
  },

  getCurrentUser: async function(token, additional_parameters) {
      var contacts = await module.exports.getContacts(token)
      var user = {}
      contacts.forEach((contact) => {
        if(contact['me'] === true)
          user = contact
      })
      return user
  },

  getTasks: async function(token, additional_parameters) {
    return get('https://www.wrike.com/api/v4/tasks', token, additional_parameters)
  },

  createTask: async function(token, name, description, responsible, folder, start, due) {
    var post_message = 'title=' +  name
    if (description !== '') post_message += '&description=' + description
    if (responsible !== '') post_message += '&responsibles=["' + responsible + '"]'
    if (folder !== '') post_message += '&parents=["' + folder + '"]'
    if (due !== '' || start !== '') {
      post_message += '&dates={'
      if (start !== '') post_message += '"start":"' + start + '"'
      if (start !== '' && due !== 'undefined') post_message += ','
      if (due !== '') post_message += '"due":"' + due + '"'
      post_message += '}'
    }

    var path = 'https://www.wrike.com/api/v4/folders/'
    if (folder !== '') path += folder + '/tasks'
    // Root folder
    else path += 'IEABRDPJI7777777/tasks'

    var response = await axios.post(path, post_message, {
      headers: {
        Authorization: 'bearer ' + token
      }
    })
    return response
  }

}
