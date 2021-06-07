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

    translate.translateText(emailBody, genesysCloudLanguage, function(translatedData) {
        console.log('TRANSLATED DATA: ' + JSON.stringify(translatedData));

        view.addMessage(translatedData.translated_text, 'customer');
        translationData = translatedData;
    });
}

function translateMessage(){
    let message = document.getElementById('message-textarea').value;
    let sourceLang;

    // Default language to english if no source_language available    
    if(translationData === null) {
        sourceLang = 'en';
    } else {
        sourceLang = translationData.source_language;
    }

    translate.translateText(message, sourceLang, function(translatedData) {
        console.log('TRANSLATED DATA: ' + JSON.stringify(translatedData));

        view.addMessage(translatedData.translated_text, 'agent');

        // Send email
        sendMessage(translatedData.translated_text, () => {
            console.log('EMAIL SENT');
        });

        // Copy to clipboard
        // copyToClipboard(translatedData.translated_text);
    });
}

function sendMessage(message){
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
        'textBody': message,
        'historyIncluded': true
    }

    conversationsApi.postConversationsEmailMessages(currentConversationId, body);
}

function copyToClipboard(message){
    var dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = message;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
}

/** --------------------------------------------------------------
 *                       EVENT HANDLERS
 * -------------------------------------------------------------- */
document.getElementById('message-textarea')
    .addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            // Translate typed message
            translateMessage();

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
