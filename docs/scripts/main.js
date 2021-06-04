import view from './view.js';
import controller from './notifications-controller.js';
import translate from './translate-service.js';
import config from './config.js';

// Obtain a reference to the platformClient object
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

// API instances
const usersApi = new platformClient.UsersApi();
const conversationsApi = new platformClient.ConversationsApi();
const responseManagementApi = new platformClient.ResponseManagementApi();

let userId = '';
let agentName = 'AGENT_NAME';
let agentAlias = 'AGENT_ALIAS';
let customerName = 'CUSTOMER_NAME';
let currentConversation = null;
let currentConversationId = '';
let translationData = null;
let genesysCloudLanguage = 'en-us';
let translateKey = '';
let messageId = '';

/**
 * Callback function for 'message' and 'typing-indicator' events.
 * 
 * @param {Object} data the event data  
 */
let onMessage = (data) => {
    switch(data.metadata.type){
        case 'typing-indicator':
            break;
        case 'message':

            console.log('ON MESSAGE: ' + JSON.stringify(data));

            // Values from the event
            let eventBody = data.eventBody;
            let message = eventBody.body;
            let senderId = eventBody.sender.id;

            // Conversation values for cross reference
            let participant = currentConversation.participants.find(p => p.chats[0].id == senderId);
            let name = participant.name;
            let purpose = participant.purpose;

            // Wait for translate to finish before calling addChatMessage
            translate.translateText(message, genesysCloudLanguage, function(translatedData) {
                view.addChatMessage(name, translatedData.translated_text, purpose);
                translationData = translatedData;
            });

            break;
    }
};

/**
 *  Translate then send message to the customer
 */
function sendChat(){
    let message = document.getElementById('message-textarea').value;

    // Get the last agent participant, this also fixes an issue when an agent
    // gets reconnected and reassigned a new participant id.
    let agentsArr = currentConversation.participants.filter(p => p.purpose == 'agent');
    let agent = agentsArr[agentsArr.length - 1];
    let communicationId = agent.chats[0].id;

    let sourceLang;

    // Default language to english if no source_language available    
    if(translationData === null) {
        sourceLang = 'en';
    } else {
        sourceLang = translationData.source_language;
    }

    // Translate text to customer's local language
    translate.translateText(message, sourceLang, function(translatedData) {
        // Wait for translate to finish before calling sendMessage
        sendMessage(translatedData.translated_text, currentConversationId, communicationId);
    });

    document.getElementById('message-textarea').value = '';
};

/**
 *  Send message to the customer
 */
function sendMessage(message, conversationId, communicationId){
    console.log(message);
    conversationsApi.postConversationsChatCommunicationMessages(
        conversationId, communicationId,
        {
            'body': message,
            'bodyType': 'standard'
        }
    )
}

function getEmailBody(body){
    let emailBody = body.textBody;
    let sourceLang;

    // Default language to english if no source_language available    
    if(translationData === null) {
        sourceLang = 'en';
    } else {
        sourceLang = translationData.source_language;
    }

    translate.translateText(emailBody, sourceLang, function(translatedData) {
        console.log('TRANSLATED DATA: ' + JSON.stringify(translatedData));
    });
}

/** --------------------------------------------------------------
 *                       EVENT HANDLERS
 * -------------------------------------------------------------- */
document.getElementById('chat-form')
    .addEventListener('submit', () => sendChat());

document.getElementById('btn-send-message')
    .addEventListener('click', () => sendChat());

document.getElementById('message-textarea')
    .addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendChat();
            if(e.preventDefault) e.preventDefault(); // prevent new line
            return false; // Just a workaround for old browsers
        }
    });

/** --------------------------------------------------------------
 *                       INITIAL SETUP
 * -------------------------------------------------------------- */
const urlParams = new URLSearchParams(window.location.search);
currentConversationId = urlParams.get('conversationid');
genesysCloudLanguage = urlParams.get('language');

client.setPersistSettings(true, 'chat-translator');
client.setEnvironment(config.genesysCloud.region);
client.loginImplicitGrant(
    config.clientID,
    config.redirectUri,
    { state: JSON.stringify({
        conversationId: currentConversationId,
        language: genesysCloudLanguage
    }) })
.then(data => {
    console.log(data);

    // Assign conversation id
    let stateData = JSON.parse(data.state);
    currentConversationId = stateData.conversationId;
    genesysCloudLanguage = stateData.language;
    
    return conversationsApi.getConversationsEmail(currentConversationId);
}).then(data => {
    console.log(data);

    messageId = data.participants.find(p => p.purpose == 'customer').messageId;

    return conversationsApi.getConversationsEmailMessage(currentConversationId, messageId);
}).then((data) => { 
    console.log(data);

    return getEmailBody(data);
}).then(data => {
    console.log('Finished Setup');

// Error Handling
}).catch(e => console.log(e));
