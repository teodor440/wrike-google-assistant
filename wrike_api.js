'use strict';

const https = require('https')
const axios = require('axios')

var options = {
  hostname: 'www.wrike.com',
  path: '/api/v4',
  method: 'GET',
  headers: {
    Authorization: 'bearer auth_code'
  }
};

function sendRequest(options, body) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      // console.log("statusCode: ", res.statusCode);
      // console.log("headers: ", res.headers);
      var message = ''
      res.on('data', (chunk) => {
              message += chunk
      });
      res.on('end', () => {
        resolve(JSON.parse(message)['data'])
      })
    }).on("error", (error) => {
      console.log("Error sending request to wrike: " + error.message);
    });
    if (typeof body !== 'undefined') req.write(body)
    req.end();
  })
}

// fields=["metadata"] <=> {fields: ['metadata']}
function addParameters(url, params) {
  var parameters = '?'
  for(var key in params){
    parameters += key + '=' + params[key].toString()
    parameters += '&'
  }
  parameters = parameters.slice(0, -1)

  return url + parameters
}

module.exports = {
  getFolderTree: async function(token, additional_parameters) {
    options['headers']['Authorization'] = 'bearer ' + token;
    options['path'] = '/api/v4/folders'
    options['method'] = 'GET'

    if(typeof params !== 'undefined')
      options['path'] = addParameters(options['path'], parameters)

    var data = await sendRequest(options)

    return data
  },

  getFoldersInfo: async function(token, folderIdArray, additional_parameters) {
    options['headers']['Authorization'] = 'bearer ' + token;
    options['path'] = '/api/v4/folders'
    options['method'] = 'GET'
    let ids = ''
    folderIdArray.forEach((folder) => {
      ids += folder + ','
    })
    if(ids !== '') {
      ids[ids.length - 1] = null
      ids = '/' + ids
    }
    options += ids

    if(typeof params !== 'undefined')
      options['path'] = addParameters(options['path'], parameters)

    var data = await sendRequest(options)

    return data
  },

  getContacts: async function(token, additional_parameters) {
    options['headers']['Authorization'] = 'bearer ' + token;
    options['path'] = '/api/v4/contacts'
    options['method'] = 'GET'

    if(typeof params === 'true')
      options['path'] = addParameters(options['path'], parameters)

    var data = await sendRequest(options)

    return data
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
    options['headers']['Authorization'] = 'bearer ' + token;
    options['path'] = '/api/v4/tasks'
    options['method'] = 'GET'

    if(typeof params !== 'undefined')
      options['path'] = addParameters(options['path'], parameters)

    var data = await sendRequest(options)

    return data
  },

  createTask: async function(token, name, description, responsable, folder, due) {
    options['headers']['Authorization'] = 'bearer ' + token;
    options['path'] = '/api/v4/folders/'
    options['method'] = 'POST'
    options['path'] += folder + '/tasks'

    var post_message = 'title=' +  name + '&description=' + description + '&responsibles=["' + responsable + '"]&parents=["' + folder + '"]'
    if (typeof due !== 'undefined') post_message += '&dates={"due":"' + due + '"}'

    options['headers']['Content-Length'] = post_message.length // post_message.length
    options['headers']['Content-Type'] = 'application/www-x-form-urlencoded'
    options['headers']['Accept'] = '*/*'

    axios.post('https://www.wrike.com' + options['path'], post_message, {headers: {Authorization: 'bearer ' + token}})
    .then((res) => {
      // console.log(`statusCode: ${res.statusCode}`)
      // console.log(res)
    })
    .catch((error) => {
      console.error(error)
    })
  }

}
