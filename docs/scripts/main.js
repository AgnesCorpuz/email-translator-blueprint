import view from './view.js';
import translate from './translate-service.js';
import config from './config.js';

// Obtain a reference to the platformClient object
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

// API instances
const conversationsApi = new platformClient.ConversationsApi();
let currentConversationId = '';
let translationData = null;
let genesysCloudLanguage = 'en-us';
let messageId = '';
let customerEmail = '';
let customerName = '';
let agentEmail = '';
let agentName = '';
let subject = '';

function getEmailDetails(data){
    let emailBody = data.textBody;

    // Get email details
    customerEmail = data.from.email;
    customerName = data.from.name;
    agentEmail  = data.to[0].email;
    agentName = data.to[0].name;
    subject = data.subject;

    translateMessage(emailBody, genesysCloudLanguage, 'customer')
    .then((translatedData) => {
        translationData = translatedData;
    });
}

function translateMessage(message, language, purpose){
    return new Promise((resolve, reject) => {
        translate.translateText(message, language, function(data) {
            if (data) {
                console.log('TRANSLATED DATA: ' + JSON.stringify(data));

                view.addMessage(data.translated_text, purpose);
                resolve(data);
            }
        });
    });
}

function sendMessage(){
    let message = document.getElementById('message-textarea').value;

    translateMessage(message, getSourceLanguage(), 'agent')
    .then((translatedData) => {
        let body = {
            'to': [{
                'email': customerEmail,
                'name': customerName
            }],
            'from': {
                'email': agentEmail,
                'name': agentName
            },
            'subject': subject,
            'textBody': translatedData.translated_text,
            'historyIncluded': true
        }
    
        conversationsApi.postConversationsEmailMessages(currentConversationId, body);

        console.log('Translated email sent to customer!');
    });    
}

function copyToClipboard(){
    let message = document.getElementById('message-textarea').value;

    translateMessage(message, getSourceLanguage(), 'agent')
    .then((translatedData) => {
        var dummy = document.createElement('textarea');
        document.body.appendChild(dummy);
        dummy.value = translatedData.translated_text;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);

        console.log('Translated message copied to clipboard!');
    });
}

function getSourceLanguage(){
    let sourceLang;

    // Default language to english if no source_language available    
    if(translationData === null) {
        sourceLang = 'en';
    } else {
        sourceLang = translationData.source_language;
    }

    return sourceLang;
}

/** --------------------------------------------------------------
 *                       EVENT HANDLERS
 * -------------------------------------------------------------- */
document.getElementById('btn-send')
    .addEventListener('click', () => sendMessage());

document.getElementById('btn-copy')
    .addEventListener('click', () => copyToClipboard());

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
    
    // Get messageId
    return conversationsApi.getConversationsEmail(currentConversationId);
}).then(data => {
    console.log(data);

    messageId = data.participants.find(p => p.purpose == 'customer').messageId;

    // Get email details
    return conversationsApi.getConversationsEmailMessage(currentConversationId, messageId);
}).then((data) => { 
    console.log(data);

    return getEmailDetails(data);
}).then(data => {
    console.log('Finished Setup');

// Error Handling
}).catch(e => console.log(e));
