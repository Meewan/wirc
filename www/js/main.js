"use strict";
var socket;
var currentChannel;
var pseudo;
init();
window.onbeforeunload  = quitting;
function init()
{
    socket = io.connect();
    socket.on('back',backMessageHandler);

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
    //creation des callbacks
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
    socket.on('error', ircErrorHandler);
    socket.on('action', actionMessageHandler);
    socket.on('pvtaction', privateActionMessageHandler);
    pseudo = data.pseudo;
    for(var i = 0; i < data.channels.length; i++)
    {
        currentChannel = data.channels[i];
        var channel = data.channels[i].replace('#','_');
        var chanDOM = '<div class="chanWrapper" id="chan' + channel + 'wrapper">';
            chanDOM += '<div class="chanUsers" id="chan' + channel + 'users">';
            chanDOM += '</div>';
            chanDOM += '<div class="chanMain" id="chan' + channel + 'main">';
                chanDOM += '<div class="chanTopic" id="chan' + channel + 'topic">';
                chanDOM += '</div>';
                chanDOM += '<table class="chanData" id="chan' + channel + 'data">';
                chanDOM += '</table>';
                chanDOM += '<div class="chanLower" id="chan' + channel + 'lower">';
                    chanDOM += '<span id="pseudo" >';
                        chanDOM += pseudo;
                    chanDOM += '</span>';
                    chanDOM += '<input class="chanInput" type="text" id="chan' + channel + 'input" onKeyPress="if (event.keyCode == 13){send(\'' + channel + '\')}"  />';
                chanDOM += '</div>';
            chanDOM += '</div>';
        chanDOM += '</div>';
        document.getElementById('irc').innerHTML += chanDOM;
        if(i !== 0)
        {
            document.getElementById('chan' + data.channels[i-1].replace('#','_') + 'wrapper').style.display = 'none';
        }
        getTopic(data.channels[i]);
        getNames(data.channels[i]);
    }
}

function send(chan)
{
    var channel = chan.replace('_','#');
    var message = document.getElementById('chan' + chan + 'input').value;
    var type = messageType(message);
    message = messageFilter(message, type);
    socket.emit('message', JSON.stringify({
        command :type,
        channel : channel,
        message : message
    }));
    document.getElementById('chan' + chan + 'input').value = '';
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
            else if(arg0 == '/nick')
            {
                return 'nick';
            }
        }
    }
}

function messageFilter(message, command)
{
    if (command === 'message')
    {
        return message;
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
function getTopic(channel)
{
    socket.emit('message', JSON.stringify({
        channel : channel,
        command : 'topic'
    }));
}

function getNames(channel)
{
    socket.emit('message', JSON.stringify({
        channel : channel,
        command : 'names'
    }));
    console.log('names');
}

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
    var channel = chan.replace('#','_');
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
    document.getElementById('chan' + channel + 'data').innerHTML += line;
}
/**
 * redraw the userlist for a channel
 * @param chan
 * @param users
 */
function displayUserOnChan(chan, users)
{
    var channel = chan.replace('#','_');
    var line = '';
    for(var user in users)
    {
        line += '<div id="userChan' +channel + user +'" class="user">' + users[user] + user + '</div>';
    }
    document.getElementById('chan' + channel + 'users').innerHTML = line;

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
        document.getElementById('pseudo').innerHTML = pseudo;
    }
    var user = htmlSpecialChar(usr);
    var chanUser = null;
    for(var i = 0; i < chan.length; i++)
    {
        var channel = chan[i].replace('#','_');
        if(action === 'add')
        {
            chanUser = document.getElementById('userChan' +channel + user);
            if (chanUser === null)
            {
                document.getElementById('chan' + channel + 'users').innerHTML += '<div id="userChan' + channel + user + '" class="user">' + user + '</div>';
            }
            else
            {
                chanUser.style.display = 'block';
            }

        }
        else if (action === 'remove')
        {
            chanUser = document.getElementById('userChan' + channel + user);
            if (chanUser !== null)
            {
                chanUser.style.display = 'none';
            }

        }
        else if(action === 'nick')
        {
            chanUser = document.getElementById('userChan' +channel + user);
            if(chanUser !== null)
            {
                chanUser.innerHTML = newName;
                chanUser.id = 'userChan' +channel + newName;
            }

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
    var channel = chan.replace('#','_');
    document.getElementById('chan' + channel + 'topic').innerHTML = '<span class="topicWord" >' + htmlSpecialChar(topic) + '</span>';
}
//////////////////////////////////socket handler////////////////////////////////////////////////////////////////////////
function backMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.channels)
    {
        document.getElementById('loginForm').style.display = 'none';
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
    printMessage(data.date, 'MOTD', currentChannel, data.data, 'motdMessage');
}

function namesMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    displayUserOnChan(data.channel, data.data);
}

function topicMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateTopicOnChan(data.channel, data.data);
}

function joinMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('add',data.channel, data.from);
    printMessage(data.date, '--->', data.channel,  data.from + ' joined the chan ', 'joinMessage');
}

function partMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('remove',data.channel, data.from);
    printMessage(data.date, '|<---', data.channel, data.from + ' parted the chan '+ (data.data ? data.data : ''), 'partMessage');
}

function quitMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('remove', data.channels,data.from);
    printMessage(data.date, '<---', data.channels, data.from + ' quited the network '+ (data.data ? data.data : ''), 'quitMessage');
}

function kickMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('remove',data.channel, data.target);
    printMessage(data.date, '|<---', data.channel, data.target +' was kick by ' + data.by + (data.data ? 'reason : ' + data.data : ''), 'kickMessage');
}

function killMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('remove', data.channels,data.target);
    printMessage(data.date, '<---', data.channels, data.target + ' quited the network '+ (data.data ? data.data : ''), 'killMessage');
}

function messageMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, data.from, data.channel, data.data, 'plainMessage');
}

function actionMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, data.from, data.channel, data.data, 'actionMessage');
}

function noticeMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, data.from, (data.target ? data.target : currentChannel), data.data, 'noticeMessage');
}

function pingMessageHandler(serialized)
{
    //do nothing
}

function nickMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    updateUserOnChan('nick', data.to, data.from, data.data);
    printMessage(data.date, '=-=' , data.to , data.from + ' is now known as ' + data.data, 'nickMessage');
}

function pmMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, data.from, data.channel, data.data, 'pmMessage');
}

function privateActionMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, data.from, data.channel, data.data, 'pmAction');
}

function addModeMessageHandler(serialized)
{
    //todo modes
}

function remModeMessageHandler(serialized)
{
    //todo modes
}

function whoisMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, '=-=', currentChannel,  + data.data.nick + ' ' + data.data.user + data.data.host, 'whois');
}

function ircErrorHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, 'ERROR', currentChannel, data.data.command, 'error');
}
function errorMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    printMessage(data.date, ERROR, currentChannel, data.data.command, 'error');
}