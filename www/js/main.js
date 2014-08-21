"use strict";
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

    for(var i = 0; i < data.channels.length; i++)
    {
     createChannel(data.channels[i], 'chan');
    }
}

function send(chan)
{
    var message = document.getElementById('chan' + channels[chan].id + 'input').value;
    var type = messageType(message);
    message = messageFilter(message, type);
    executeMessage(message, type);
    var channel = chan;
    if(type === 'pm')
    {
        type = 'message';
        channel = message.target;
        message = message.message;
    }
    if(channels[chan].type === 'pm' && type === 'part')
    {
        deleteChannel(chan);
        return;
    }
    console.log({
        command :type,
        channel : channel,
        message : message
    });
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
            history : undefined
        };
    }
    var chanDOM = '<div class="chanWrapper" id="chan' + channels[name].id + 'wrapper">';
        chanDOM += '<div class="chanUsers" id="chan' + channels[name].id + 'users">';
        chanDOM += '</div>';
        chanDOM += '<div class="chanMain" id="chan' + channels[name].id + 'main">';
            chanDOM += '<div class="chanTopic" id="chan' + channels[name].id + 'topic">';
            chanDOM += '</div>';
            chanDOM += '<table class="chanData" id="chan' + channels[name].id + 'data">';
            chanDOM += '</table>';
            chanDOM += '<div class="chanLower" id="chan' + channels[name].id + 'lower">';
                chanDOM += '<span id="' + channels[name].id + 'pseudo" >';
                    chanDOM += pseudo;
                chanDOM += '</span>';
            chanDOM += '<input class="chanInput" type="text" id="chan' + channels[name].id + 'input" onKeyPress="if (event.keyCode == 13){send(\'' + channels[name].realName + '\')}"  />';
            chanDOM += '</div>';
        chanDOM += '</div>';
    chanDOM += '</div>';
    document.getElementById('irc').innerHTML += chanDOM;
    document.getElementById('chanIndex').innerHTML += '<div class="chanindex" id="chan' + channels[name].id + 'index" onclick="setFocus(\'' + name + '\')" >' + channels[name].name +'</div>';

    setFocus(name);
    getTopic(name);
    getNames(name);
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
            else
            {
                return arg0.substring(1);
            }
        }
    }
}

function executeMessage(message, type)
{

}
function messageFilter(message, command)
{
    if (command === 'message')
    {
        return message;
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
}
/**
 * redraw the userlist for a channel
 * @param chan
 * @param users
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
        }
        users[user].right[chan] = (userList[user] == undefined ? '' : userList[user]);
        line += '<div id="userChan' + channels[chan].id + users[user].id +'" class="user">' + users[user].right[chan] + users[user].name + '</div>';
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
            document.getElementById(channels[chanpseudo].id +'pseudo').innerHTML = pseudo;
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
            users[usr].right[channels[chan].realName] ='';
            chanUser = document.getElementById('userChan' +channels[chan].id + users[usr].id);
            if (chanUser === null)
            {
                document.getElementById('chan' + channels[chan].id + 'users').innerHTML += '<div id="userChan' + channels[chan].id + users[usr].id + '" class="user">' + users[usr].name + '</div>';
            }
            else
            {
                chanUser.style.display = 'block';
            }

        }
        else if (action === 'remove')
        {
            chanUser = document.getElementById('userChan' + channels[chan].id + users[usr].id);
            users[usr] = undefined;
            if (chanUser !== null)
            {
                chanUser.style.display = 'none';
            }

        }
        else if(action === 'nick')
        {
            users[newName] = {
                id : 'u_'+ idCount++,
                name : htmlSpecialChar(newName),
                right : new Array()
            };
            users[newName].right[chan] = users[usr].right[chan];
            chanUser = document.getElementById('userChan' + channels[chan].id + users[usr].id);
            if(chanUser !== null)
            {
                chanUser.innerHTML = users[newName].right[chan] + users[newName].name;
                chanUser.id = 'userChan' + channels[chan].id + users[newName].id;
            }
            users[usr] = undefined;
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
    displayUserOnChan(data.channel, data.data);
}

function topicMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
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

}

function partMessageHandler(serialized)
{
    var data = JSON.parse(serialized);
    if(data.from === pseudo)
    {
        deleteChannel(data.channel);
    }
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
    if(data.target === pseudo)
    {
        deleteChannel(data.channel);
    }
    updateUserOnChan("remove",data.channel, data.target);
    printMessage(data.date, '|<---', data.channel, (data.target +' was kick by ' + data.by + (data.data ? ' reason : ' + data.data : '')), 'kickMessage');
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
    printMessage(data.date, data.from, (data.target ? data.target : currentChannel.realName), data.data, 'noticeMessage');
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
    if(channels[data.from] === undefined)
    {
        createChannel(data.from, 'pm');
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
    printMessage(data.date, data.from, data.from, data.data, 'pmAction');
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
    printMessage(data.date, '=-=', currentChannel.realName,  + data.data.nick + ' ' + data.data.user + data.data.host, 'whois');
}

function ircErrorHandler(serialized)
{
    var data = JSON.parse(serialized);
    //TODO construire une tableau associatif des messages d'erreurs
    printMessage(data.date, 'ERROR', currentChannel.realName, data.data.command, 'error');
}
function errorMessageHandler(data)
{
    var data = JSON.parse(data);//magic if you manage the error it il not ork
}