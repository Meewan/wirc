var config ='';
var serverConfigFile = 'config.json';
var connected = 0;
var http = require('http');
var crypto = require('crypto');
var file = new(static.Server)();
var static = require('node-static');
var irc = require('irc');
var redis = require('redis');
var redisClient;
var client; //client irc
//loading configuration
var fs = require('fs');
fs.readFile(serverConfigFile, 'utf-8', function(err, data)
    {
        config = JSON.parse(data);
        createServer();
    });

function createServer()
{
    startRedis(redis);
    startIRC(irc);
    var app = http.createServer(function (req, res) {
        file.serve(req, res);
    }).listen(config.web.port);


///////////////////////////////////the connection to the webclients logic///////////////////////////////////////////////
    io = require('socket.io').listen(app);
    io.sockets.on('connection', function (socket)
    {
        var session;
        socket.on('submitconnect', function (serialized)
        {
            data = JSON.parse(serialized);
            if (data.user.toLowerCase() === config.web.login.toLowerCase() && data.password === config.web.password)
            {
                session = {connected : true};
                connected ++;
                socket.room = 'logged';
                socket.join(socket.room);
                socket.emit('back', JSON.stringify({
                    channels: config.irc.channels,
                    pseudo : config.irc.user
                }));
                userPseudoManagement();
            }
            else
            {
                session = {connected : false};
                socket.emit('back',JSON.stringify(
                {
                    "error": 'wrongAuth'
                }));
            }
        });

        socket.on('systemHistory', function(serialized)
        {
            var data = JSON.parse(serialized);
            if( session !== undefined && session.connected === true )
            {
                if(data.command === 'history')
                {
                    getFromRedis(data.channel, data.offset, data.length, function(redisData, err)
                    {
                        socket.emit('systemHistory', JSON.stringify({
                            channel : data.channel,
                            error : err,
                            data : redisData
                        }));
                    });
                }
            }
        });

        socket.on('message', function(serialized)
        {
            var data = JSON.parse(serialized);
            if( session !== undefined && session.connected === true )
            {
                if(data.command === 'names')
                {
                    names(data.channel);
                }
                else if(data.command === 'action')
                {
                    actionListener(config.irc.user, data.channel, data.message, null);
                    action(data.channel, data.message);
                }
                else if(data.command === 'nick')
                {
                    nick(data.message);
                }
                else if(data.command === 'join')
                {
                    join(data.message);
                }
                else if(data.command === 'part')
                {
                    part(data.channel, data.message);
                }
                else if(data.command == 'kick')
                {
                    kick(data.channel, data.message.target, data.message.reason);
                }
                else if(data.command === 'topic')
                {
                    topic(data.channel, data.message);
                }
                else if(data.command === 'pass')
                {
                    pass(data.message);
                }
                else if(data.command === 'whois')
                {
                    whois(data.message);
                }
                else if(data.command === 'mode')
                {
                    mode(data.channel, data.message.mode, data.message.target);
                }
                else
                {
                    messageListener(config.irc.user, data.channel, data.message, null);
                    say(data.channel, data.message);
                }
            }
        });

        socket.on('disconnect', function () {
            //sessions = deleteFromArray(sessions, session.sessionId);
            if(session !== undefined && session.connected === true)
            {
                if (connected > 0)
                {
                    connected --;
                }
                userPseudoManagement();
            }
            session = undefined;
        });
    });
}

function userPseudoManagement()
{
    if(config.irc.user.substr(config.irc.user.lastIndexOf("["), 6) === '[away]' && connected > 0)
    {
        nick(config.irc.user.substring(0,config.irc.user.lastIndexOf("[")));
    }
    else if(connected === 0)
    {
        nick(config.irc.user += '[away]');
    }
}
////////////////////////////////////the connection to irc logic/////////////////////////////////////////////////////////
function startIRC(irc)
{
    client = new irc.Client(config.irc.server, config.irc.user,
        {
            port: config.irc.port,
            channels: config.irc.channels,
            userName: config.irc.userName,
            realName: config.irc.clientName,
            debug: false
        });

    client.addListener('registered', function (message)
    {
        var data =
        {
            type : 'connected',
            date : (new Date().getTime()),
            data: message
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('motd', function (message)
    {
        var data =
        {
            type : 'motd',
            date : (new Date().getTime()),
            data: message
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('names', function (chan, nicks)
    {

        var data =
        {
            type : 'names',
            date : (new Date().getTime()),
            channel : chan,
            data : nicks
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('topic', function (channel, topic, nick, message)
    {
        var data =
        {
            type : 'topic',
            date : (new Date().getTime()),
            channel : channel,
            from : nick,
            data :topic
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('join', function (channel, nick, message)
    {
        var data =
        {
            type : 'join',
            date : (new Date().getTime()),
            channel : channel,
            from :nick
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('part', function (channel, nick, reason, message)
    {
        var data =
        {
            type : 'part',
            date : (new Date().getTime()),
            channel : channel,
            from : nick,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('quit', function (channels, nick, reason, message)
    {
        var data =
        {
            type : 'quit',
            date : (new Date().getTime()),
            channels : channels,
            from : nick,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('kick', function (channel, nick, reason, by, message)
    {
        var data =
        {
            type : 'kick',
            date : (new Date().getTime()),
            channel : channel,
            target : nick,
            from : by,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('kill', function (nick, reason, channels, message)
    {
        var data =
        {
            type : 'kill',
            date : (new Date().getTime()),
            channels : channels,
            target : nick,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('message#', messageListener);

    client.addListener('notice', function (nick, to, text, message)
    {
        var data =
        {
            type : 'notice',
            date : (new Date().getTime()),
            from : nick,
            target : to,
            data :text
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('ping', function (server)
    {
        var data =
        {
            type : 'ping',
            date : (new Date().getTime()),
            data :server
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('pm', function (nick, text, message)
    {
        var data =
        {
            type : 'pm',
            date : (new Date().getTime()),
            from : nick,
            data :text
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('nick', function (oldnick, newnick, channels, message)
    {
        if (oldnick === config.irc.user)
        {
            config.irc.user = newnick;
            fs.writeFile(serverConfigFile, JSON.stringify(config));
        }
        var data =
        {
            type : 'nick',
            date : (new Date().getTime()),
            from : oldnick,
            to : channels,
            data :newnick
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('+mode', function (channel, by, mode, argument, message)
    {
        var data =
        {
            type : '+mode',
            date : (new Date().getTime()),
            from : by,
            to : argument,
            channel : channel,
            data :mode
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('-mode', function (channel, by, mode, argument, message)
    {
        var data =
        {
            type : '-mode',
            date : (new Date().getTime()),
            from : by,
            to : argument,
            channel : channel,
            data :mode
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('whois', function (whois)
    {
        var data =
        {
            type : 'whois',
            date : (new Date().getTime()),
            to : whois.nick,
            data :whois
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('error', function (error)
    {
        var data ={
            type : 'ircerror',
            date : (new Date().getTime()),
            data :error
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('action', actionListener);
}

function actionListener (from, channel, message)
{
    var data =
    {
        type : (channel === config.irc.user ? 'pvtaction' :'action'),
        date : (new Date().getTime()),
        from : from,
        channel : channel,
        data :message
    };
    storeInRedis(data);
    io.sockets.in('logged').emit(data.type, JSON.stringify(data));
}

function messageListener(from, channel, text, message)
{
    var data =
    {
        type : 'message',
        date : (new Date().getTime()),
        from : from,
        channel : channel,
        data :text
    };
    storeInRedis(data);
    io.sockets.in('logged').emit(data.type, JSON.stringify(data));
}
//-----------------------------actions on IRC------------------------------------------------------------------//
function nick(newNick)
{
    client.send("NICK", newNick);
}
function names(channel)
{
    if (channel === undefined || channel === null || channel === '')
    {
        client.send("NAMES");
    }
    else
    {
        client.send("NAMES", channel);
    }

}
function topic(channel, topic)
{
    if(topic !== null && topic !== undefined)
    {
        client.send('TOPIC', channel, topic);
    }
    else
    {
        client.send('TOPIC', channel);
    }
}

function kick(channel, target, reason)
{
    if(topic !== null && topic !== undefined)
    {
        client.send('KICK', channel, target);
    }
    else
    {
        client.send('KICK', channel, target, ':'+reason);
    }
}
function pass(pass)
{
    if(pass === undefined || pass === null)
    {
        pass = '';
    }
    client.send('PASS', pass);
}
function say(target, message)
{
    client.say(target, message);
}
function join(channel)
{
    client.join(channel);
    config.irc.channels.push(channel);
    fs.writeFile(serverConfigFile, JSON.stringify(config));
}

function part(channel, reason)
{
    client.part(channel,(reason === null || reason === undefined ? '' : reason));
    deleteFromChannels(channel);
    fs.writeFile(serverConfigFile, JSON.stringify(config));
}

function action(channel, text)
{
    client.action(channel, text);
}
function mode(channel, mode, user)
{
    if(user)
    {
        client.send('MODE', channel, mode, user);
    }
    else
    {
        client.send('MODE', channel, mode);
    }

}
function whois(target)
{
    client.whois(target);
}
//-----------------------------listeners------------------------------------------------------------------------//
///////////////////////////////////redis logic//////////////////////////////////////////////////////////////////////////

function startRedis(redis)
{
    redisClient = redis.createClient();

}

function getFromRedis(chan,offset, range, callback)
{
    var start = offset;
    var end = offset + range;

    if(!(start === end ) )
    {
        redisClient.lrange('chan_' + chan.replace('#',''), start, end, function (err, data){
            callback(data, err);
        });
    };
}

function storeInRedis(data)
{
    if(data.channels)
    {
        for(var i = 0; i < data.channels.length; i++)
        {
            storeInRedisChannel(data, data.channels[i]);
        }
    }
    else if(data.type === 'pm' || data.type === 'pvtaction')
    {
        redisClient.lpush('pvt_' + data.from.toLowerCase(), JSON.stringify(data));
    }
    else if(data.channel)
    {
        storeInRedisChannel(data, data.channel);
    }
    else if (data.type === 'motd')
    {
        redisClient.lpush('motd', JSON.stringify(data));
    }
    else if(data.type !== 'ping')
{
        redisClient.lpush('client', JSON.stringify(data));
    }
}

function storeInRedisChannel(data, channel)
{
    redisClient.lpush('chan_' + channel.replace('#',''), JSON.stringify(data));
}

///////////////////////////////////the generic logic////////////////////////////////////////////////////////////////////


/**
 * method that delete an element from an array
 * !!!!!VERY SLOW DO NOT USE IF THERE IS AN OTHER WAY!!!!!!!!!!
 * @param position
 * @param array
 */
function deleteFromArray(array, position)
{
    var tmpArray = new Array();
    for (var i = 0; i < array.length; i++)
    {
        if(array[i] !== array[position])
        {
            tmpArray[i] = array[i];
        }
    }
    return tmpArray;
}

function deleteFromChannels (chan)
{
    var tmp = new Array();
    var found = false;
    var tmpChan;
    while(!found && config.irc.channels.length !== 0)
    {
        tmpChan = config.irc.channels.pop();
        if(tmpChan === chan)
        {
            found = true;
        }
        else
        {
            tmp.push(tmpChan);
        }
    }
    while(tmp.length !== 0 )
    {
        config.irc.channels.push(tmp.pop())
    }
}

