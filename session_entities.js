// Session entities are used to recognize dynamic generated values in dialgoflow intents
// This file is here for when the bug will be solved: https://issuetracker.google.com/issues/133166381

// Loads in our node.js client library which we will use to make API calls.
const dialogflowAPI = require('dialogflow');

// Read in credentials from file. To get it, follow instructions here, but
// chose 'API Admin' instead of 'API Client':
// https://dialogflow.com/docs/reference/v2-auth-setup
const credentials = require('./credentials.json');

// Create a new EntityTypesClient, which communicates
// with the EntityTypes API endpoints.
const entitiesClient = new dialogflowAPI.v2.SessionEntityTypesClient({
  credentials: credentials,
});

// Create a path string for our agent based
// on its project ID (from first tab of Settings).
const projectId = 'wrike-assistant-aa48f';


/** Define a custom error object to help control flow in our Promise chain. */
class EntityNotFoundError extends Error {};

module.exports = {
  // session like in conv.body.session
  // values of the form [{value:'name', synonyms:['related value']}]
  createEntity: function(session, entity_name, values) {
    // Define an EntityType to represent cities.

    var name_path = session + '/entityTypes/' + entity_name
    const definedEntityType = {
      // id: '60f11960-bae2-41a6-8965-6f1dd1eda99f',
      name: name_path,
      displayName: entity_name,
      // kind: 'KIND_MAP',
      entityOverrideMode: 'ENTITY_OVERRIDE_MODE_SUPPLEMENT',
      // List all of the Entities within this EntityType.
      entities: values,
    };

    // Build a request object in the format the client library expects.
    const request = {
      parent: session,
      sessionEntityType: definedEntityType,
    };

    // Tell client library to call Dialogflow with
    // a request to create an EntityType.
    entitiesClient
        .createSessionEntityType(request)
    // Dialogflow will respond with details of the newly created EntityType.
        .then((responses) => {
          console.log('Created new entity type:', JSON.stringify(responses[0]));
        })
    // Log any errors.
        .catch((err) => {
          console.error('Error creating entity type:', err);
        });
  },

  logEntities: function (session) {
    entitiesClient.listSessionEntityTypes({parent: session})
      .then(responses => {
        const resources = responses[0];
        for (const resource of resources) {
          console.log(resource)
        }
      })
      .catch(err => {
        console.error(err);
      });
  }
}
