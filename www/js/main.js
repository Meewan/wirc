"use strict";
var debug = true;
var HISTORY_LENGTH = 50;
var HISTORY_STEP = 50;
var SCROLL_TOLERANCE = 10;
var socket;
var currentChannel;
var pseudo;
var channels = new Array();
var users =new Array();
var idCount = 1;
init();
function init()
{
    socket = io.connect();
    socket.on('back',backMessageHandler);
    socket.on('error', errorMessageHandler);//magic
    //creation des callbacks irc
    socket.on('connected', connectedMessageHandler);
    socket.on('motd', motdMessageHandler);
    socket.on('names', namesMessageHandler);
    socket.on('topic', topicMessageHandler);
    socket.on('join', joinMessageHandler);
    socket.on('part', partMessageHandler);
    socket.on('quit', quitMessageHandler);
    socket.on('kick', kickMessageHandler);
    socket.on('kill', killMessageHandler);
    socket.on('message', messageMessageHandler);
    socket.on('notice', noticeMessageHandler);
    socket.on('ping', pingMessageHandler);
    socket.on('pm', pmMessageHandler);
    socket.on('nick', nickMessageHandler);
    socket.on('+mode', addModeMessageHandler);
    socket.on('-mode', remModeMessageHandler);
    socket.on('whois', whoisMessageHandler);
    socket.on('ircerror', ircErrorHandler);
    socket.on('action', actionMessageHandler);
    socket.on('pvtaction', privateActionMessageHandler);
    socket.on('systemHistory', systemHistoryHandler);


}

function submitForm()
{
    var login = document.getElementById('login').value;
    var password = document.getElementById('password').value;
    socket.emit('submitconnect', JSON.stringify({
        "user" : login,
        "password" : password
    }));
}

function main(data)
{

    pseudo = data.pseudo;

    users[pseudo] ={
        id : 'u_' + idCount++,
        name : htmlSpecialChar(pseudo),
        mode: new Array(),
        right : new Array()
    };

    for(var i = 0; i < data.channels.length; i++)
    {
     createChannel(data.channels[i], 'chan');
    }
}

/**
 * Management of all te commands issued by the user
 * @param chan
 */
function send(chan)
{
    var message = document.getElementById('chan' + channels[chan].id + 'input').value;
    updateHistory(message, chan);
    var type = messageType(message);
    message = messageFilter(message, type);
    executeMessage(message, type);
    var channel = chan;
    if(type === 'pm')
    {
        type = 'message';
        channel = message.target;
        message = message.message;
        if(type === 'part')
        {
            deleteChannel(chan);
            return;
        }
    }


    socket.emit('message', JSON.stringify({
        command :type,
        channel : channel,
        message : message
    }));
    document.getElementById('chan' + channels[chan].id + 'input').value = '';
}
/**
 * creating a channel object and the html code associated

 * @param name
 */
function createChannel(name, type)
{
    if(channels[name] === undefined)
    {
        channels[name] = {
            id: 'c_'+ idCount++,
            name: htmlSpecialChar(name),
            realName : name,
            users : new  Array(),
            type : type,
            history : Array(),
            scrolled: false,
            lineCounter : 0,
            historyCounter : -1,
            historyLock : true,
            currentLine : ''
        };
    }
    var chanDOM = '<div class="chanWrapper" id="chan' + channels[name].id + 'wrapper">';
        chanDOM += '<div class="chanUsersWrapper" >';
            chanDOM += '<table class="chanUsers" id="chan' + channels[name].id + 'users">';
            chanDOM += '</table>';
        chanDOM += '</div>';
        chanDOM += '<div class="chanMain" id="chan' + channels[name].id + 'main">';
            chanDOM += '<div class="chanTopic" id="chan' + channels[name].id + 'topic">';
            chanDOM += '</div>';
            chanDOM += '<div class="chanDataWrapper" id="chan' + channels[name].id + 'dataWrapper" onscroll="updateScrollStatut(\'' + name + '\',this)">';
                chanDOM += '<table class="chanData" id="chan' + channels[name].id + 'data">';
                    chanDOM += '<tr><td></td><td></td><td class="messageData"><hr/></td></tr>';
                chanDOM += '</table>';
            chanDOM += '</div>';
            chanDOM += '<div class="chanLower" id="chan' + channels[name].id + 'lower">';
                chanDOM += '<div class="chanPseudo" id="' + channels[name].id + 'pseudo" >';
                    chanDOM += pseudo;
                chanDOM += '</div>';
            chanDOM += '<input class="chanInput" type="text" id="chan' + channels[name].id + 'input" onKeyPress="action(event, \'' + name + '\')"  />';
            chanDOM += '</div>';
        chanDOM += '</div>';
    chanDOM += '</div>';
    document.getElementById('irc').innerHTML += chanDOM;
    document.getElementById('chanIndex').innerHTML += '<div class="chanindex" id="chan' + channels[name].id + 'index" onclick="setFocus(\'' + name + '\')" >' + channels[name].name +'</div>';

    setFocus(name);
    loadHistory(name);
    getTopic(name);
    getNames(name);
}

function action (event,name)
{
    if(event.keyCode === 38)//fleche du haut
    {
        document.getElementById('chan' + channels[name].id + 'input').value = getNextHistory(name);
    }
    else if(event.keyCode === 40)//fleche du bas
    {
        document.getElementById('chan' + channels[name].id + 'input').value = getPreviousHistory(name);
    }
    else
    {
        channels[name].historyCounter = -1;
    }
    if(event.keyCode === 13)
    {
        send(name);
    }
}

function getPreviousHistory(chan)
{
    var counter = channels[chan].historyCounter;
    counter --;
    if(channels[chan].historyCounter === -1 || counter === -1)
    {
        if(counter === -1)
        {
            channels[chan].historyCounter = counter;
        }
        else if(channels[chan].historyCounter === -1)
        {
            channels[chan].currentLine = document.getElementById('chan' + channels[chan].id + 'input').value;
        }
        return channels[chan].currentLine;
    }
    else
    {
        channels[chan].historyCounter = counter;
    }
    return channels[chan].history[channels[chan].historyCounter];
}

function getNextHistory(chan)
{
    var counter = channels[chan].historyCounter;
    if(channels[chan].historyCounter === -1)
    {
        channels[chan].currentLine =  document.getElementById('chan' + channels[chan].id + 'input').value;
    }
    counter ++;
    if (counter < channels[chan].history.length && channels[chan].history.length !== 0)
    {
        channels[chan].historyCounter = counter;
        return channels[chan].history[channels[chan].historyCounter];
    }
    else
    {
        return channels[chan].currentLine;
    }
}

function  updateHistory(message, chan)
{
    channels[chan].currentLine ='';
    channels[chan].historyCounter = -1;
    if(channels[chan].history.unshift(message) > HISTORY_LENGTH)
    {
        channels[chan].history.pop();
    }
}

function deleteChannel(channel)
{
    document.getElementById('irc').removeChild(document.getElementById('chan' + channels[channel].id + 'wrapper'));
    document.getElementById('chanIndex').removeChild(document.getElementById('chan' + channels[channel].id + 'index'));
    channels[channel] = undefined;
    cleanChannels();
    //todo find a better method to give the focus to an other chan
    for(var chan in channels)
    {
        currentChannel = channels[chan];
        setFocus(currentChannel.realName);
        return;
    }

}

function messageType(message)
{
    if(message.charAt(0) !== "/")//if it is not a commande
    {
        return 'message';
    }
    else
    {
        if(message.charAt(1) === '/')//if the user escape the command
        {
            return 'message';
        }
        else
        {
            //enumeration of the action possible
            var arg0 = getArg0(message);
            if(arg0 === '/me')
            {
                return 'action';
            }
            else if(arg0 === '/msg' || arg0 === '/message')
            {
                return 'pm';
            }
            else if(arg0 === '/identify' || arg0 === '/password')
            {
                return 'pass';
            }
            else
            {
                return arg0.substring(1);
            }
        }
    }
}

function executeMessage(message, type)
{
    if(type === 'pm')
    {
        if(channels[message.target] === undefined)
        {
            createChannel(message.target, 'pm');
        }
    }
}
function messageFilter(message, command)
{
    if (command === 'message')
    {
        if(message.charAt(0) === '/' && message.charAt(1) === '/')
        {
            return message.substr(1);
        }
        else
        {
            return message;
        }
    }
    else if (command === 'kick')
    {
        var tmp = message.substring((message.indexOf(' ') + 1));
        var reason = tmp.substring((tmp.indexOf(' ') + 1));
        var target = tmp.substring(0,(tmp.indexOf(' ')));
        if(target === '')
        {
            target = reason;
            reason = '';
        }
        return {target : target, reason : reason};
    }
    else if (command === 'part')
    {
        var tmp = message.substring((message.indexOf(' ') + 1));
        if(tmp === '/part')
        {
            return '';
        }
        return tmp;
    }
    else if(command === 'pm')
    {
        var tmp = message.substring((message.indexOf(' ') + 1));
        var message = tmp.substring((tmp.indexOf(' ') + 1));
        var target = tmp.substring(0,(tmp.indexOf(' ')));
        if(channels[target] === undefined)
        {
            createChannel(target, 'pm');
        }

        return {target : target, message : message};
    }
    else if(command === 'topic')
    {
        var message = message.substring((message.indexOf(' ') + 1));
        if (message === '/topic')
        {
            return '';
        }
        else
        {
            return message;
        }
    }
    else if(command === 'mode')
    {
        var tmp = message.substring((message.indexOf(' ') + 1));
        var target = tmp.substring((tmp.indexOf(' ') + 1));
        var mode = tmp.substring(0,(tmp.indexOf(' ')));
        if(mode === '')
        {
            mode = target;
            target = '';
        }
        return {target : target, mode : mode};
    }
    else
    {
        return message.substring((message.indexOf(' ') + 1));
    }
}

function getArg0(message)
{
    var end = message.indexOf(' ');
    if(end  <=  0)
    {
        return message.toLocaleLowerCase();
    }
    else
    {
        return message.substring(0, end).toLocaleLowerCase();
    }
}
/**
 * ask for the topic of the channel
 * @param channel
 */
function getTopic(channel)
{
    socket.emit('message', JSON.stringify({
        channel : channel,
        command : 'topic'
    }));
}

/**
 * ask the names of the connected people
 * @param channel
 */
function getNames(channel)
{
    socket.emit('message', JSON.stringify({
        channel : channel,
        command : 'names'
    }));
}
/**
 * display non the current channel and display the asked channel
 * @param channel
 */
function setFocus (channel)
{
    if(currentChannel)
    {
        document.getElementById('chan' + currentChannel.id + 'wrapper').style.display = 'none';
    }
    currentChannel = channels[channel];
    document.getElementById('chan' + currentChannel.id + 'wrapper').style.display = 'block';
}

function updateScroll(chan)
{
    if(!channels[chan].scrolled)
    {
        var element = document.getElementById('chan' + channels[chan].id + 'dataWrapper');
        element.scrollTop = element.scrollHeight;
    }
}

function updateScrollStatut(chan,element)
{
    if( (element.scrollTop - SCROLL_TOLERANCE) < 0 && !channels[chan].historyLock)
    {
        channels[chan].historyLock = true;
        loadHistory(chan);
    }
    if( element.scrollTopMax < (element.scrollTop + SCROLL_TOLERANCE))// if e are a the bottom of the chan
    {
        channels[chan].scrolled = false;
    }
    else
    {
        channels[chan].scrolled = true;
    }

}

function loadHistory(chan)
{
        socket.emit('systemHistory', JSON.stringify({
            command : 'history',
            channel : chan,
            length : HISTORY_STEP,
            offset : channels[chan].lineCounter
        }));
}
/**
 * filter the input string in order to return a safe string
 * @param text
 * @returns {XML|string|void}
 */
function htmlSpecialChar(text)
{
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function cleanChannels()
{
    var tmp = new Array();
    for(var chan in channels)
    {
        if(channels[chan] != undefined)
        {
            tmp[chan] = channels[chan];
        }
    }
    channels = tmp;
}
/**
 *
 * @param name
 */
function whois(name)
{
    socket.emit('message', JSON.stringify({
        command : 'whois',
        channel : '',
        message : name
    }));
}
///////////////////////////////////Display Logic////////////////////////////////////////////////////////////////////////
/**
 * print a message in a channel or a list of channels, if chan is "*" print the message in all channels
 * @param chan
 * @param date
 * @param type
 * @param src
 * @param msg
 */
function printMessage(date, src, chan, msg, type)
{
    if(!channels[chan])
    {
        return;
    }
    var channel = channels[chan];
    var id = channel.id;
    var sDate = new Date(date);
    var hdate = (sDate.getHours() <10 ? '[0': '[' ) +sDate.getHours() + (sDate.getMinutes() <10 ? ':0': ':' ) + sDate.getMinutes() + (sDate.getSeconds() <10 ? ':0': ':' ) + sDate.getSeconds() + ']';
    var source = htmlSpecialChar(src);
    var message = htmlSpecialChar(msg);
    var line = '<tr class="message ' + type + '">';
        line += '<td class="messageTime">';
            line +=  hdate;
        line += '</td>';
        line += '<td class="messageSource">';
            line += source;
        line += '</td>';
        line += '<td class="messageData">';
            line += message;
        line += '</td>';
    line += '</tr>';
    document.getElementById('chan' + id + 'data').innerHTML += line;
    updateScroll(chan);
}

function printHistory (historyData)
{
    //fonction de dessin pour une ligne d'historique
    var stringify = function(date, src, msg, type)
    {
        var sDate = new Date(date);
        var hdate = (sDate.getHours() <10 ? '[0': '[' ) +sDate.getHours() + (sDate.getMinutes() <10 ? ':0': ':' ) + sDate.getMinutes() + (sDate.getSeconds() <10 ? ':0': ':' ) + sDate.getSeconds() + ']';
        var source = htmlSpecialChar(src);
        var message = htmlSpecialChar(msg);
        var line = '<tr class="message ' + type + '">';
            line += '<td class="messageTime">';
                line +=  hdate;
            line += '</td>';
            line += '<td class="messageSource">';
                line += source;
            line += '</td>';
            line += '<td class="messageData">';
                line += message;
            line += '</td>';
        line += '</tr>';
        return line;
    };
    var output = '';
    var data = null;
    while(historyData.length > 0)
    {
        data = JSON.parse(historyData.pop());
        if(data.type !== 'names' && data.type !== 'whois')
        {
            if(data.type === 'message')
            {
                output += stringify(data.date, data.from, data.data, 'plainMessage');
            }
            else if(data.type === 'action')
            {
                output += stringify(data.date, data.from, data.data, 'actionMessage');
            }
            else if(data.type === '+mode')
            {
                output += stringify(data.date, '=-=', data.from + ' set mode +' + data.data + ' on '+ (data.to === undefined ? data.channel : data.to) );
            }
            else if(data.type === '-mode')
            {
                output += stringify(data.date, '=-=', data.from + ' set mode -' + data.data + ' on '+ (data.to === undefined ? data.channel : data.to) );
            }
            else if(data.type === 'nick')
            {
                output += stringify(data.date, '=-=', data.from + ' is now known as ' + data.data, 'nickMessage');
            }
            else if(data.type === 'join')
            {
                output += stringify(data.date, '--->',  data.from + ' joined the chan ', 'joinMessage');
            }
            else if(data.type === 'part')
            {
                output += stringify(data.date, '|<---', data.from + ' parted the chan '+ (data.data ? data.data : ''), 'partMessage');
            }
            else if(data.type === 'kick')
            {
                output += stringify(data.date, '|<---', (data.target +' was kick by ' + data.by + (data.data ? ' reason : ' + data.data : '')), 'kickMessage');
            }
            else if(data.type === 'kill')
            {
                output += stringify(data.date, '<---', data.target + ' quited the network '+ (data.data ? data.data : ''), 'killMessage');
            }
            else if(data.type === 'quit')
            {
                output += stringify(data.date, '<---', data.from + ' quited the network '+ (data.data ? data.data : ''), 'quitMessage');
            }
        }
        if(channels[data.channel])
        {
            channels[data.channel].lineCounter++;
        }

    }
    if(data != null)
    {
        var chan = channels[data.channel];
        var wrapper = document.getElementById('chan' + chan.id + 'dataWrapper');
        var oldHeight = wrapper.scrollHeight;
        var chanDisplay = document.getElementById('chan' + chan.id + 'data');
        chanDisplay.innerHTML = output + chanDisplay.innerHTML;
        var newHeight = wrapper.scrollHeight;
        wrapper.scrollTop = newHeight - (newHeight - oldHeight);
        chan.historyLock = false;
    }


}
/**
 * redraw the userList for a channel
 * @param chan
 * @param userList
 */
function displayUserOnChan(chan, userList)
{
    var line = '';
    for(var user in userList)
    {
        if(users[user] === undefined)
        {
            users[user] = {
                id : 'u_' + idCount ++,
                name : htmlSpecialChar(user),
                right : new Array()
            };
            whois(user);
        }
        users[user].right[chan] = (userList[user] == undefined ? '' : userList[user]);
        line += '<tr id="userChan' + channels[chan].id + users[user].id +'" class="user"><td class="userRightSymbol" id="userSymbol' + channels[chan].id + users[user].id + '">' + users[user].right[chan] +'</td><td id="userDisplayName' + channels[chan].id + users[user].id + '">' + users[user].name + '</td></tr>';
    }
    document.getElementById('chan' + channels[chan].id + 'users').innerHTML = line;
}
/**
 * add (if action == add) or remove (if action == remove) or change nick (if action == nick) a user from the chan or an
 * array of chans
 * @param action
 * @param chan
 * @param usr
 * @param newName
 */
function updateUserOnChan(action, chan, usr, newName)
{
    if(!(chan instanceof Array))
    {
        chan = [chan];
    }
    if(action === 'nick' && usr === pseudo)
    {

        pseudo = newName;
        for(var chanpseudo in channels)
        {
            document.getElementById( channels[chanpseudo].id + 'pseudo').innerHTML = pseudo;
        }

    }
    var user = users[usr];
    var chanUser = null;
    for(var i = 0; i < chan.length; i++)
    {
        if(action === 'add')
        {
            users[usr] = {
                id : 'u_'+ idCount++,
                name : htmlSpecialChar(usr),
                right : new Array()
            };
            whois(usr);
            users[usr].right[channels[chan[i]].realName] ='';

            chanUser = document.getElementById('userChan' +channels[chan[i]].id + users[usr].id);
            if (chanUser === null)
            {
                document.getElementById('chan' + channels[chan[i]].id + 'users').innerHTML += '<tr id="userChan' + channels[chan[i]].id + users[usr].id +'" class="user"><td class="userRightSymbol" id="userSymbol' + channels[chan[i]].id + users[usr].id + '">' + users[usr].right[chan[i]] +'</td><td id="userDisplayName' + channels[chan[i]].id + users[usr].id + '">' + users[usr].name + '</td></tr>';
            }
            else
            {
                chanUser.style.display = 'block';
            }

        }
        else if (action === 'remove')
        {
            chanUser = document.getElementById('userChan' + channels[chan[i]].id + users[usr].id);
            users[usr].right[chan[i]] = undefined;
            var flag = true;
            for(var j = 0; j < users[usr].right.length; j++)
            {
                if (users[usr].right[chan[j]] !== undefined)
                {
                    flag=false;
                    break;
                }
            }
            if (flag)
            {
                users[usr] = undefined;
            }
            if (chanUser !== null)
            {
                chanUser.style.display = 'none';
            }

        }
        else if(action === 'nick')
        {
            if(users[usr] !== undefined && usr !== newName )
            {
                users[newName] = {
                    id : users[usr].id,
                    name : htmlSpecialChar(newName),
                    mode : users[usr].mode,
                    right : users[usr].right
                };
                whois(newName);
                users[usr] = undefined;
            }
            chanUser = document.getElementById('userChan' + channels[chan[i]].id + users[newName].id);
            if(chanUser !== null)
            {
                var displayName = document.getElementById('userDisplayName' + channels[chan[i]].id + users[newName].id).innerHTML = users[newName].name;
                displayName.id = 'userDisplayName' + channels[chan[i]].id + users[newName].id;
                document.getElementById('userSymbol' + channels[chan[i]].id + users[newName].id).id = 'userSymbol' + channels[chan[i]].id + users[newName].id;
                chanUser.id = 'userChan' + channels[chan[i]].id + users[newName].id;
            }
        }
        else if(action ='update')
        {
            document.getElementById('userSymbol' + channels[chan[i]].id + users[usr].id).innerHTML = users[usr].right[chan];
        }
        chanUser = null;
    }
}
/**
 * Update the topic for a channel
 * @param chan
 * @param topic
 */
function updateTopicOnChan(chan, topic)
{
    document.getElementById('chan' + channels[chan].id + 'topic').innerHTML = '<span class="topicWord" >' + htmlSpecialChar(topic) + '</span>';
}

//////////////////////////////////socket handler////////////////////////////////////////////////////////////////////////
function backMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.channels)
    {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('irc').style.display = 'block';
        main(data);
    }
    else if(data.error)
    {
        if(data.error === 'wrongAuth')
        {
            document.getElementById('password').value = '';
        }
    }
}

/**
 * fired when the server is connected to irc
 * @param serialized
 */
function connectedMessageHandler(serialized)
{
    //do nothing
}

/**
 * fired when a MOTD is received from irc
 * @param serialized
 */
function motdMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, 'MOTD', currentChannel.realName, data.data, 'motdMessage');
}

function namesMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }
    displayUserOnChan(data.channel, data.data);
}

function topicMessageHandler(serialized)
{
    //TODO prevenir l'utilisateur que le topic a changé
    var data = JSON.parse(serialized);
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }
    if(data.data)
    {
        updateTopicOnChan(data.channel, data.data);
    }
}

function joinMessageHandler(serialized)
{

    var data = JSON.parse(serialized);
    if(data.from === pseudo)
    {
        createChannel(data.channel, 'chan');
    }
    else
    {
        updateUserOnChan('add',data.channel, data.from);
        printMessage(data.date, '--->', data.channel,  data.from + ' joined the chan ', 'joinMessage');
    }
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }

}

function partMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.from === pseudo)
    {
        deleteChannel(data.channel);
    }
    else
    {
        updateUserOnChan('remove',data.channel, data.from);
        printMessage(data.date, '|<---', data.channel, data.from + ' parted the chan '+ (data.data ? data.data : ''), 'partMessage');
        if(channels[data.channel])
        {
            channels[data.channel].lineCounter ++;
        }
    }
}

function quitMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('remove', data.channels,data.from);
    for(var i = 0; i < data.channels.length; i++)
    {
        printMessage(data.date, '<---', data.channels[i], data.from + ' quited the network '+ (data.data ? data.data : ''), 'quitMessage');
        if(channels[data.channels[i]])
        {
            channels[data.channels[i]].lineCounter ++;
        }
    }
}

function kickMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.target === pseudo)
    {
        deleteChannel(data.channel);
    }
    else
    {
        updateUserOnChan("remove",data.channel, data.target);
        printMessage(data.date, '|<---', data.channel, (data.target +' was kick by ' + data.by + (data.data ? ' reason : ' + data.data : '')), 'kickMessage');
        if(channels[data.channel])
        {
            channels[data.channel].lineCounter ++;
        }
    }
}

function killMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('remove', data.channels,data.target);
    for(var i = 0; i < data.channels.length; i++)
    {
        printMessage(data.date, '<---', data.channels[i], data.target + ' quited the network '+ (data.data ? data.data : ''), 'killMessage');
        if(channels[data.channels[i]])
        {
            channels[data.channels[i]].lineCounter ++;
        }
    }
}

function messageMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }
    printMessage(data.date, data.from, data.channel, data.data, 'plainMessage');
}

function actionMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }
    printMessage(data.date, data.from, data.channel, data.data, 'actionMessage');
}

function noticeMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, data.from, currentChannel.realName, data.data, 'noticeMessage');
}

function pingMessageHandler(serialized)
{
    //do nothing
}

function nickMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('nick', data.to, data.from, data.data);
    for(var i = 0; i < data.to.length; i++)
    {
        printMessage(data.date, '=-=' , data.to[i] , data.from + ' is now known as ' + data.data, 'nickMessage');
    }
}

function pmMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(channels[data.from] === undefined)
    {
        createChannel(data.from, 'pm');
    }
    if(channels[data.from])
    {
        channels[data.from].lineCounter ++;
    }
    printMessage(data.date, data.from, data.from, data.data, 'pmMessage');
}

function privateActionMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(channels[data.from] === undefined)
    {
        createChannel(data.from, 'pm');
    }

    if(channels[data.from])
    {
        channels[data.from].lineCounter ++;
    }
    printMessage(data.date, data.from, data.from, data.data, 'pmAction');
}

function addModeMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.to !== undefined)
    {
        users[data.to].whoisString = undefined;
        whois(data.to);
    }
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }
    printMessage(data.date, '=-=', data.channel, data.from + ' set mode +' + data.data + ' on '+ (data.to === undefined ? data.channel : data.to) );
}

function remModeMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.to !== undefined)
    {
        users[data.to].whoisString = undefined;
        whois(data.to);
    }
    if(channels[data.channel])
    {
        channels[data.channel].lineCounter ++;
    }
    printMessage(data.date, '=-=', data.channel, data.from + ' set mode -' + data.data + ' on '+ (data.to === undefined ? data.channel : data.to) );
}

function whoisMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    var whoisString = data.data.nick + '<' + data.data.user  +'@'+ data.data.host + '> "' + data.data.realname +'"';

    var whoisChannels = '';
    var isOnAChan = true;
    var flag = true;
    for(var chan in data.data.channels)
    {
        var cleanChan;
        var symbole;
        if(data.data.channels[chan].substr(0,1) === '#')
        {
            symbole = ' ';
            cleanChan = data.data.channels[chan];
        }
        else
        {
            symbole = data.data.channels[chan].substr(0,1);
            cleanChan = data.data.channels[chan].substr(1);
        }
        if(!flag)
        {
            whoisChannels += ' and ';
        }
        whoisChannels += data.data.channels[chan];
        flag = false;
        if(channels[cleanChan] && users[data.data.nick])
        {
            users[data.to].right[cleanChan] = symbole;
            updateUserOnChan('update', cleanChan, data.data.nick);
        }
        if(users[data.data.nick].right[cleanChan] === undefined)
        {
            isOnAChan = false;
        }
    }
    if(users[data.to].whoisString !== undefined && isOnAChan)
    {
        printMessage(data.date, '---', currentChannel.realName,  'Start of WHOIS information for ' + data.data.nick, 'whois');
        printMessage(data.date, '=-=', currentChannel.realName, whoisString, 'whois');
        printMessage(data.date, '=-=', currentChannel.realName,  data.data.nick + ' : member of ' + whoisChannels, 'whois');
        printMessage(data.date, '=-=', currentChannel.realName,  data.data.nick + ' : attached to ' + data.data.server + ' "'+data.data.serverinfo + '"', 'whois');
        printMessage(data.date, '=-=', currentChannel.realName,  data.data.nick + ' : idle for ' + data.data.idle + ' seconds', 'whois');
        printMessage(data.date, '---', currentChannel.realName,  'End of WHOIS information for ' + data.data.nick, 'whois');
    }
    users[data.to].whoisString = whoisString;

}

function ircErrorHandler(serialized)
{
    var data = JSON.parse(serialized);
    //TODO construire une tableau associatif des messages d'erreurs
    printMessage(data.date, 'ERROR', currentChannel.realName, data.data.command, 'error');
}
function errorMessageHandler(data)
{
    var data = JSON.parse(data);//magic if you manage the error it il not work
}

function systemHistoryHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.data && data.data.length >0)
    {
        printHistory(data.data);
    }
    channels[data.channel].historyLock = false;
}