/**
 * This script is focused on the HTML / displaying of data to the page
 */
function updateScroll(){
    let div = document.getElementById('agent-assist');
    div.scrollTop = div.scrollHeight;
}

export default {

    addMessage(message, purpose){
        let chatMsg = document.createElement('p');
        chatMsg.textContent = message;

        let container = document.createElement('div');
        container.appendChild(chatMsg);
        container.className = 'chat-message ' + purpose;
        container.id = 'agent-message';
        document.getElementById('agent-assist').appendChild(container);

        updateScroll();
    }
}