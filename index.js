/* Notes
	Sadly, shouldn't modify Array.prototype to add my own quick method because it adds them in the other files too
*/
module.exports = Discord => {
	let Parser = require('./textparser.js');
	let EventEmitter = require('events');
	let Log = require('./log.js');

	console.table = function (...args) {
		console.log('=====================================================================');
		for (let i = 0; i < args.length; i += 2) {
			console.log(args[i], ':', args[i + 1]);
		}
		console.log('=====================================================================');
	}

	let Helper = {
		var: { // helpful variables
			commands: {
				set: ["set", "="],
				get: ["get", "check"],

				// math
				add: ["add", "increase", "give", "+"],
				sub: ["sub", "subtract", "decrease", "take", "-"],
				multiply: ["times", "multiply", "x", "*"],
				divideBy: ["divideby", "divide by", "divide_by", "/"],
				divide: ["divide", "a/"],

				// general
				leaderboard: ["leaderboard", "leaders", "topboard", "top"]
			},
			Error: {
				wrong: "wrong argument",
				noCommand: "wrong command",
				noUsers: "no mentions"
			},
			regex: {
				everyone: Discord.MessageMentions.EVERYONE_PATTERN,
				role: Discord.MessageMentions.ROLES_PATTERN,
				user: Discord.MessageMentions.USERS_PATTERN,

				userParen: /\((user(:|=| ).*?#\d+)\)/gi,
				roleParen: /\((role(:|=| ).*?)\)/gi,

				at: /\@/g
			}
		},
		// #region functions
		send(send, preface = "") { // makes a send function that replaces everything that shouldn't be repeated
			return async msg => {
				let values = (preface + msg.replace(Helper.var.regex.at, ' @ ')).match(/[^]{1,1800}/g);
				for (let i = 0; i < values.length; i++) { // Promises are the root of all evil, await/async is rather useful <3
					await send(values[i]);
				}
			}
		},
		reply(reply, user) {
			return Helper.send(reply, user.toString() + ", ");
		},
		randomArray(arr) {
			return arr[Helper.randomArrayIndex(arr)];
		},
		randomArrayIndex(arr) {
			return Helper.randomInteger(arr.length - 1, 0);
		},
		randomInteger(max = 20, min = 1) { // 1-20, including 1 and 20
			return Math.floor(Math.random() * (max - min + 1)) + min;
		},
		hasRole(member, role) {
			if (Helper.isArray(role)) {
				let values = false;
				for (let i = 0; i < role.length; i++) {
					values = values || Helper.hasRole(member, role[i]);
				}
				return values;
			}
			if (Helper.isNumber(Helper.Number(role))) { // because ID's are strings
				return Helper.hasRoleByID(member, role);
			} else if (Helper.isString(role)) { // name
				return Helper.hasRoleByName(member, role);
			} else if (Helper.isRole(role)) {
				return Helper.hasRoleByID(member, role.id);
			}
			Log.warn("hasRole function ran with a non-known type of role. It's value was:", role);
			return false;
		},
		hasRoleByID(member, roleID) {
			return member.roles.has(roleID);
		},
		hasRoleByName(member, roleName) {
			roleName = roleName.toLowerCase();
			return Helper.isRole(member.roles.find(role => role.name.toLowerCase() === roleName));
		},
		parseMentions(text, client, guild) {
			let users = Helper.match(text, Helper.var.regex.user)
				.map(userMention => client.users.get(
					userMention.substring(userMention[2] === '!' ? 3 : 2, userMention.length - 1)
				))

				.concat(Helper.match(text, Helper.var.regex.userParen)
					.map(userTag => userTag.substring(6, userTag.length - 1).trim().toLowerCase())
					.map(userTag => client.users.find(
						user => user && user.tag && user.tag.toLowerCase() === userTag
					)))


				.concat(Helper.match(text, Helper.var.regex.role)
					.map(roleMention => guild.roles.get(roleMention.substring(3, roleMention.length - 1)))
					.concat(Helper.match(text, Helper.var.regex.roleParen)
						.map(roleName => { // 1 map is logically more efficient, though multiple can be easier to quickly read
							roleName = roleName.substring(6, roleName.length - 1).trim().toLowerCase();
							if (roleName === 'everyone') {
								roleName = '@everyone';
							}
							return guild.roles.find(role => role.name.toLowerCase() === roleName)
						})
					)

					.filter(role => Helper.isRole(role))
					.reduce((prev, cur) => prev.concat(cur.members.array()), []));

			let everyoneMatch = Helper.match(text, Helper.var.regex.everyone);
			if (everyoneMatch.length > 0) {
				let everyone = guild.members.array();
				for (let i = 0; i < everyoneMatch.length; i++) {
					users.concat(everyone);
				}
			}

			return users
				.filter(user => Helper.isUser(user, "discord"))
				.map(member => member.user || member);
		},
		capitalize(string, everyWord = false) {
			if (everyWord === true) {
				return string
					.split(' ')
					.map(str => Helper.capitalize(str, false)) // woo, recursiveness
					.join(' ');
			} else {
				return string[0].toUpperCase() + string.substring(1);
			}
		},
		Number(value) { // parse a string to a number, because JS Number is annoying
			if (!Helper.isNumber(value, true)) {
				if (value === '' || value === false || value === null) {
					value = NaN; // these values would normally evaluate to 0
				} else {
					value = Number(value);
				}
			}
			return value;
		},
		getUserByID(userID, guild, client) {
			if (Helper.isUser(userID, "discord")) {
				return userID;
			}

			if (Helper.isUser(userID, "custom")) {
				userID = userID.id;
			}

			if (Helper.isClient(client, "custom")) {
				client = client.client;
			}

			if (Helper.isGuild(guild, "custom")) {
				guild = client.guilds.get(guild.id);
			}

			let user = null;

			if (Helper.isGuild(guild, "discord")) {
				user = guild.members.get(userID);
			}

			if (!Helper.isUser(user, "discord") && Helper.isClient(client, "discord")) {
				user = client.users.get(userID);
			}

			if (!Helper.isUser(user, "discord")) {
				return null;
			}

			return user || null;
		},
		getUser(user, guild, client) {
			if (Helper.isUser(user, "discord") || Helper.isUser(user, "custom")) {
				user = user.id;
			}
			return Helper.getUserByID(user, guild, client);
		},
		loop(iterator, func) { // just foreach, but it returns the original value
			iterator.forEach(func);
			return iterator;
		},
		flatten(text, separator = " ") { // flattens an array of text into a string, recursively
			let flat = "";

			if (Helper.isString(text)) {
				flat = text;
			} else if (Helper.isArray(text)) {
				for (let i = 0; i < text.length; i++) {
					flat += Helper.flatten(text[i], separator);
					if (i < (text.length - 1)) {
						flat += ' '; // add spaces, except for the last
					}
				}
			} // otherwise ignore it

			return flat || "";
		},
		not(bool) {
			return !!bool;
		},
		run(func, ...args) { // run the function if it is one
			return Helper.isFunction(func) ? func(...args) : func;
		},
		breakFirst(arr, func) { // returns the first truthy value, otherwise null
			for (let i = 0; i < arr.length; i++) {
				if (func(arr[i], i, arr)) {
					return arr[i];
				}
			}
			return null;
		},
		truthy(...args) { // returns first truthy value
			return Helper.breakFirst(args, arg => !!arg);
		},
		precedence(...args) { // returns first value that isn't undefined or null
			return Helper.breakFirst(args, arg => arg !== undefined && arg !== null);
		},
		divide(arr, func, destTrue = [], destFalse = []) { // essentially filter, but false ones get dumped into a separate array
			arr.forEach((value, index, array) => {
				if (func(value, index, array)) {
					destTrue.push(value);
				} else {
					destFalse.push(value);
				}
			})
			return [destFalse, destTrue];
		},
		hasProperty(val, propName, strict = true) {
			if (Helper.isObject(val)) {
				if (strict === true) {
					return val.hasOwnProperty(propName);
				} else {
					return Object.keys(val).indexOf(propName) !== -1;
				}
			}
			return !!val[propName]; // TODO: Do a better check
		},
		getTypeFunction(type = 'string') {
			// todo: make a quick way of doing this, wrapper function perhaps?
			if (type === 'string') {
				return Helper.isString;
			} else if (type === 'boolean' || type === 'bool') {
				return Helper.isBoolean;
			} else if (type === 'object' || type === 'obj') {
				return Helper.isObject; // TODO: let them decide if it's strict based on string
			} else if (type === 'array' || type === 'arr') {
				return Helper.isArray;
			} else if (type === 'function' || type === 'func') {
				return Helper.isFunction;
			} else if (type === 'message' || type === 'msg') {
				return Helper.isMessage;
			} else if (type === 'channel') {
				return Helper.isChannel;
			} else if (type === 'textchannel' || type === 'text-channel' || type === 'text channel') {
				return Helper.isTextChannel;
			} else if (type === 'guild' || type === 'server') {
				return Helper.isGuild; // TODO: let them decide if the type of guild
			} else if (type === 'member') {
				return Helper.isMember;
			} else if (type === 'command') {
				return Helper.isCommand;
			} else if (type === 'commandlist') {
				return Helper.isCommandList;
			} else if (type === 'client') {
				return Helper.isClient;
			} else if (type === 'regex') {
				return Helper.isRegex;
			}
			Log.warn(`getTypeFunction function ran with invalid type of: '${type}'`);
			return () => false;
		},
		is(val, type = 'or', ...types) {
			if (type === 'or') {
				return Helper.isOR(val, ...types);
			} else if (type === 'and') {
				//return Helper.isAND(val, types); // TODO: implement this
			} else {
				Log.warn(`is function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isOR(val, ...types) {
			return types.map(type => Helper.getTypeFunction(type)(val)) // turns it into an array of bools
				.reduce((prev, cur) => prev || cur); // shrinks them all into one value
		},
		// #region isType
		isRole(role) {
			return role instanceof Discord.Role;
		},
		isNumber(num, strict = true) {
			return typeof (num) === 'number' && (strict === true ? (!Number.isNaN(num) && num !== Infinity && num !== -Infinity) : true);
		},
		isString(str) {
			return typeof (str) === 'string'; // don't use instanceof, because that doesn't work with normal strings
		},
		isBoolean(bool, strict = true) {
			if (strict === false && (bool === 'true' || bool === 'false')) {
				return true;
			}
			return typeof (bool) === 'boolean';
		},
		isObject(obj, strict = true) { // if strict, make sure it's not an Array
			return obj instanceof Object && (strict ? !Helper.isArray(obj) : true);
		},
		isArray(arr) {
			return Array.isArray(arr);
		},
		isFunction(func) {
			return func instanceof Function && typeof (func) === 'function';
		},
		isMessage(message) {
			return message instanceof Discord.Message;
		},
		isUser(user, type = "custom") {
			if (type === "discord") {
				return user instanceof Discord.User || user instanceof Discord.GuildMember;
			} else if (type === "custom") {
				return user instanceof User;
			} else {
				Log.warn(`isUser function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isChannel(channel) {
			return channel instanceof Discord.Channel;
		},
		isTextChannel(channel) {
			return channel instanceof Discord.TextChannel;
		},
		isGuild(guild, type = "custom") {
			if (type === "discord") {
				return guild instanceof Discord.Guild;
			} else if (type === "custom") {
				return guild instanceof Guild;
			} else {
				Log.warn(`isGuild function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isMember(member) {
			return member instanceof Discord.GuildMember;
		},
		isCommand(command) {
			return command instanceof Command;
		},
		isCommandList(commandList) {
			return commandList instanceof CommandList;
		},
		isClient(client, type = "custom") {
			if (type === "discord") {
				return client instanceof Discord.Client;
			} else if (type === "custom") {
				return client instanceof Client;
			} else {
				Log.warn(`isClient function ran with invalid type of: '${type}'`);
				return false;
			}
		},
		isRegex(regex) {
			return regex instanceof RegExp;
		},
		// #endregion isType
		getPrefix(client, guild) {
			if (Helper.isClient(client) && Helper.isGuild(guild)) {
				return client.defaultPrefix || guild.settings.prefix || 'k!'; // TODO: do more than just nothing if the prefix doesn't exist
			}
			return 'k!'; // default, woo
		},
		match(text, regex) { // a match that always returns an array, for my own sanity
			let result = Helper.precedence(text, '').match(regex);
			if (!Helper.isArray(result)) {
				if (Helper.isString(result)) {
					result = [result];
				} else {
					result = [];
				}
			}
			return result;
		},
		replaceKeyWords(text, args, customCommandName = '') { // TODO: split this out so it can be done without args
			if (Helper.isString(text) && Helper.isObject(args)) {
				return text.replace(/\$prefix/gi, args.prefix)
					.replace(/\$(commandname|command\-name|command\_name|command\.name)/gi, customCommandName ? customCommandName : args.commandName);
			}
			return text; // return it if it didn't work TODO: make this error thing better
		}
		// #endregion functions
	};
	class Storage { // not for storing anything you couldn't store in json
		constructor(initValue = 0) {
			this.store = {};

			this.initValue = initValue;
		}

		static fromData(data, initValue) {
			let storage = new Storage(initValue);

			if (Helper.isObject(data)) {
				storage.store = data.store;
			}

			return storage;
		}

		increase(key, amount = 0, def) {
			let value = this.get(key, def);
			if (Helper.isNumber(value)) {
				return this.set(key, value + amount);
			}
			return false;
		}

		decrease(key, amount = 0) {
			return this.increase(key, -amount);
		}

		getData() {
			return {
				store: this.store,
				initValue: this.initValue
			};
		}

		create(key = null, strict = true, val) {
			if (key) {
				if (strict === true && this.store.hasOwnProperty(key)) {
					return false;
				}

				if (val === undefined) val = this.initValue;

				return this.set(key, val);
			}
			return false;
		}

		set(key = null, val = null) {
			if (key) {
				this.store[key] = val;
				return true;
			}
			return false;
		}

		get(key, def) {
			if (!this.store.hasOwnProperty(key)) {
				this.create(key, true, def);
			}
			return this.store[key];
		}
	}

	class User {
		constructor(id = null) {
			this.id = id; // the id of the user
			this.permissions = {}; // the permissions that the user is allowed to use
			this.storage = new Storage(0);
		}

		static fromData(data, id) {
			let user = new User(id);

			if (Helper.isObject(data)) {
				user.permissions = data.permissions;
				user.storage = Storage.fromData(data.storage, 0);
			}

			return user;
		}

		getData() {
			let user = {};
			user.id = this.id;
			user.permissions = this.permissions;
			user.storage = this.storage.getData();

			return user;
		}
	}
	class Command {
		constructor(name = "", onRun = null, other = null) {
			// the name(s) of the command
			if (!Helper.isArray(name)) {
				name = [name]; // turn it into an array, simplest this way;
			}
			// Divides (filters) it into two arrays of [False, True]
			this.name = Helper.divide(name, commandName => Helper.isString(commandName));

			if (this.name[0].length !== 0) {
				Log.warn("A command being made with the names:", name, "\nHad the following non-commands (non-strings):", this.name[0]);
			}
			// turns them all lowercase
			this.name = this.name[1].map(commandName => commandName.toLowerCase()); // turn all the strings to lowercase

			this.onRun = Helper.precedence(onRun, args => true);

			// Stores other functions/values to be used later
			this.other = Helper.precedence(other, {});
		}

		run(args) { // could shorten this too: return this.isAllowed(args) && this.run.call(this, args)
			if (this.isAllowed(args)) { // but that's barely readable
				this.onRun.call(this, args);
				return true;
			}
			return false;
		}

		matchesName(name = '', getIndex = false) {
			if (Helper.isString(name)) {
				name = name.toLowerCase();

				for (let i = 0; i < this.name.length; i++) {
					if (this.name[i] === name) {
						if (getIndex === true) {
							return i; // returns the index that it's found at
						}
						return true;
					}
				}
			}
			return false;
		}

		isAllowed(...data) {
			return Helper.precedence(Helper.run(Helper.precedence(this.other, {}).allowed, ...data), true);
		}

		getDescription(args, useText = true) {
			if (Helper.is(this.other.description, 'or', 'function', 'string')) {
				if (useText) {
					return Helper.run(this.other.description, args) + '\n';
				}
				return true;
			}

			if (useText) {
				return 'There is no description for this command.\n';
			}
			return false;
		}

		getUsageInfo(args, useText = true) {
			if (Helper.is(this.other.usage, 'or', 'function', 'string')) {
				if (useText) {
					return Helper.run(this.other.usage, args) + '\n';
				}
				return true;
			}
			if (useText) {
				return 'There is no usage information for this command.\n';
			}
			return false;
		}

		getHelpText(args) {
			let text = '';

			text += this.getDescription(args, true);
			text += this.getUsageInfo(args, true);

			return text;
		}
	}
	class CommandList {
		constructor() {
			this.list = [];
		}
		// #region add command
		// TODO: Shorten addSetterCommand and addStatCommand so they repeat less
		// A function to quickly create commands to store guild specific info. Like Gryffindor's points, etc
		addSetterCommand(name, valueName, type = "string", other = {}) {
			if (!Helper.isObject(other)) {
				other = {};
			}
			if (!Helper.isFunction(other.onModifiedValue)) {
				other.onModifiedValue = (value, oldValue, args) => args.reply("Value was set too: " + value);
			}
			if (!Helper.isFunction(other.onError)) {
				other.onError = (error, value, args) => {
					if (error === "wrong argument") {
						args.reply("Value was invalid.");
					} else if (error === "wrong command") {
						args.reply("Action was invalid.");
					} else {
						args.reply("Unknown Error.");
					}
				};
			}
			if (!Helper.isFunction(other.onValueRetrieved)) {
				other.onValueRetrieved = (value, args) => args.reply('The value is: ' + value);
			}

			if (!Helper.isFunction(other.usage) && !Helper.isString(other.usage)) {
				other.usage = args => {
					let pre = "`$prefix$commandName";

					let text = pre + "` - Acquires the stored value.\n";
					text += pre + " set [value]` - Sets valuer.\n";

					if (type === 'number') {
						text += pre + " add [value]` - Adds value to the oldValue. (oldValue+value)\n";
						text += pre + " sub [value]` - Subtracts value from the oldValue. (oldValue-value)\n";
						text += pre + " multiply [value]` - Multiply the oldValue by value. (oldValue*value)\n";
						text += pre + " divideby [value]` - Divides the oldValue by value. (oldValue/value)\n";
						text += pre + " divide [value]` - Divides value by oldValue. (value/oldValue).";
					}

					return text;
				}
			}

			other = Object.assign({ // merge the objects
				valueName,
				type
			}, other);

			let run = function (args) {
				let cmd = Helper.flatten(args.content[1]).toLowerCase();
				let argument = Helper.flatten(args.content[2]).toLowerCase();

				let type = this.other.type;
				let valueName = this.other.valueName;

				let storage = args.customGuild.storage;

				if (!storage.store.hasOwnProperty(valueName)) {
					let value = null;
					if (type === "string") {
						value = "";
					} else if (type === "number") {
						value = 0;
					}
					storage.set(valueName, value);
				}

				if (cmd === "" || !Helper.isString(cmd) || Helper.var.commands.get.includes(cmd)) {
					let val;
					if (type === "string") {
						val = "";
					} else if (type === "number") {
						val = 0;
					}
					return this.other.onValueRetrieved(storage.get(valueName, val), args);
				}

				if (type === "string") {
					if (Helper.var.commands.set.includes(cmd)) {
						if (argument === "" || !Helper.isString(argument)) {
							return this.other.onError(Helper.var.Error.wrong, argument, args);
						}
						storage.set(valueName, argument);
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, args);
					}
				} else if (type === "number") {
					argument = Helper.Number(argument);

					if (!Helper.isNumber(argument, true)) {
						return this.other.onError(Helper.var.Error.wrong, argument, args);
					}

					let storageValue = storage.get(valueName, 0);
					let oldVal = storageValue;

					if (Helper.var.commands.set.includes(cmd)) { // set
						storageValue = argument;
					} else if (Helper.var.commands.add.includes(cmd)) { // addition
						storageValue += argument;
					} else if (Helper.var.commands.sub.includes(cmd)) { // subtract
						storageValue -= argument;
					} else if (Helper.var.commands.multiply.includes(cmd)) { // multiple
						storageValue *= argument;
					} else if (Helper.var.commands.divideBy.includes(cmd)) { // divide by
						if (argument === 0) { // num / 0 = Infinity
							return this.other.onError(Helper.var.Error.divideByZero, argument, args);
						}
						storageValue /= argument;
					} else if (Helper.var.commands.divide.includes(cmd)) { // divide
						if (storageValue === 0) {
							return this.other.onError(Helper.var.Error.divideByZero, argument, args);
						}
						storageValue = argument / storageValue;
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, args);
					}

					storage.set(valueName, storageValue);
					return this.other.onModifiedValue(storageValue, oldVal, args);
				} else {
					// this is more of an internal problem TODO: make this better
					return this.other.onError(Helper.var.Error.noCommand, argument, args);
				}
			}

			let command = new Command(name, run, other);

			this.addCommand(command);

			return command;
		}
		/* 
			A function to quickly create commands that are like:
			!commandname set x @user1 @role1 @user2 @all
			TODO: add better specification on type like:
			number.integer.positive means that it must be a number, an integer, and non-negative
			string#lowercase#reverse means that before storing it will be lowercased, then reversed
			string.length>=5#lowercase means the length must be greater than or equal to 5, then it will be lowercased
		*/
		addStatCommand(name, valueName, type = "string", other = {}) {
			if (!Helper.isArray(name)) {
				name = [name];
			}

			if (!Helper.isString(valueName)) {
				Log.warn(`valueName in the ${name[0]} command is not a string.`);
			}

			// #region other
			if (!Helper.isObject(other)) {
				other = {};
			}
			if (!Helper.isFunction(other.onModifiedValue)) {
				other.onModifiedValue = (value, users, args) => args.reply("Succeeded in operation.");
			}
			if (!Helper.isFunction(other.onError)) {
				other.onError = (error, value, users, args) => {
					if (error === "wrong argument") {
						args.reply("Value was invalid.");
					} else if (error === "wrong command") {
						args.reply("Action was invalid.");
					} else if (error === "no mentions") {
						args.reply("No users were mentioned.");
					} else {
						Log.warn(`Stat command with the valueName: '${valueName}' gave an unknown error of: '${error}'`);
						args.reply("Unknown Error.");
					}
				};
			}
			if (!Helper.isFunction(other.onValueRetrieved)) {
				other.onValueRetrieved = (users, args) => args.reply('Values:\n' + users.map(user => {
					let val;
					if (type === "string") {
						val = "";
					} else if (type === "number") {
						val = 0;
					}
					return Helper.getUser(user, args.guild, args.Client).displayName + ' : ' + user.storage.get(valueName, val);
				}).join('\n'));

			}

			if (!Helper.isBoolean(other.noMentionsAffectsUser)) {
				other.noMentionsAffectsUser = true;
			}

			// leaderboard
			if (!Helper.isObject(other.leaderboard)) {
				other.leaderboard = {};
			}
			if (!Helper.isBoolean(other.leaderboard.allowed)) {
				other.leaderboard.allowed = true; // whether there should be a leaderboard
			}
			if (!Helper.isNumber(other.leaderboard.entries)) {
				other.leaderboard.entries = 10; // the amount of entries to show
			}
			if (!Helper.isBoolean(other.leaderboard.displayNonMembers)) {
				other.leaderboard.displayNonMembers = false; // whether or not to display users who've left
			}
			if (!Helper.isFunction(other.leaderboard.onLeaderboard)) {
				other.leaderboard.onLeaderboard = (results, {
					send
				}) => send(results
					.reduce((prev, cur) => `${prev}\n*${cur[0].displayName || cur[0].username}* : ${cur[1]}`, '**Leaderboard:**'));
			}

			// Help/Description
			if (!Helper.isFunction(other.description) && !Helper.isString(other.description)) {
				other.description = 'Stores a stat for each user in the form of a ' + type + '.';
			}

			if (!Helper.isFunction(other.usage) && !Helper.isString(other.usage)) {
				other.usage = args => {
					let pre = "`$prefix$commandName";
					// TODO: make this better
					let text = pre + "` - Acquires the value stored.\n";
					text += pre + " [mention]+` - Gets mentioned user's values.\n";
					text += pre + " set [value]` - Sets the value of yourself (if that's enabled).\n"
					text += pre + " set [value] [mention]+` - Sets value of each mentioned user.\n";

					if (type === 'number') {
						text += pre + " add [value] [mention]+` - Adds value to each mentioned user. (user+value)\n";
						text += pre + " sub [value] [mention]+` - Subtracts value from each mentioned user. (user-value)\n";
						text += pre + " multiply [value] [mention]+` - Multiply each mentioned user by value. (user*value)\n";
						text += pre + " divideby [value] [mention]+` - Divides each mentioned user by value. (user/value)\n";
						text += pre + " divide [value] [mention]+` - Divides value by each mentioned user, and sets it. (value/user).\n";

						if (Helper.run(other.leaderboard.allowed, args)) {
							text += pre + " leaderboard` - Generates a top " + other.leaderboard.entries + " leaderboard.";
						}
					}
					return text;
				}
			}

			other = Object.assign({ // merge the objects
				valueName,
				type
			}, other);
			// #endregion other

			let run = function (args) {
				let cmd = Helper.flatten(args.content[1]).toLowerCase();
				let argument = Helper.flatten(args.content[2]); // shouldn't be lowercase

				let mentions = Helper.parseMentions(args.message.content, args.Client.client, args.guild)
					.map(user => args.customGuild.getUserByID(user.id));

				let type = this.other.type;
				let valueName = this.other.valueName;

				if (mentions.length === 0 && this.other.noMentionsAffectsUser === true) {
					mentions = [args.customUser];
				}

				let cmdMentions = Helper.parseMentions(cmd, args.Client.client, args.guild);
				if (!Helper.isString(cmd) || cmd === "" || cmd === "get" || cmd === "check" || cmdMentions.length > 0) {
					return this.other.onValueRetrieved(mentions, args);
				}

				if (mentions.length === 0 && !(Helper.var.commands.leaderboard.includes(cmd) && Helper.run(this.other.leaderboard.allowed, args) === true)) { // TODO: make so it complains about the argument before users
					return this.other.onError(Helper.var.Error.noUsers, argument, mentions, args);
				}

				if (type === "string") {
					if (Helper.var.commands.set.includes(cmd)) {
						if (argument === "" || !Helper.isString(argument)) {
							return this.other.onError(Helper.var.Error.wrong, argument, mentions, args);
						}

						mentions.forEach(user => user.storage.set(valueName, argument));
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, mentions, args);
					}
				} else if (type === "number") {
					argument = Helper.Number(argument);
					if (!Helper.isNumber(argument, true) && !(Helper.var.commands.leaderboard.includes(cmd) && Helper.run(this.other.leaderboard.allowed, args) === true)) {
						return this.other.onError(Helper.var.Error.wrong, argument, mentions, args);
					}

					if (Helper.var.commands.set.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument));
					} else if (Helper.var.commands.add.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument + user.storage.get(valueName, 0)));
					} else if (Helper.var.commands.sub.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, user.storage.get(valueName, 0) - argument));
					} else if (Helper.var.commands.multiply.includes(cmd)) {
						mentions.forEach(user => user.storage.set(valueName, argument * user.storage.get(valueName, 0)));
					} else if (Helper.var.commands.divideBy.includes(cmd)) {
						mentions.forEach(user => {
							if (argument === 0) { // num / 0 = Infinity
								return; // TODO: don't be silent
							}
							user.storage.set(valueName, user.storage.get(valueName, 0) / argument);
						});
					} else if (Helper.var.commands.divide.includes(cmd)) {
						mentions.forEach(user => {
							let oldValue = user.storage.get(valueName, 0);
							if (olValue === 0) { // num / 0 = Infinity
								return; // TODO: don't be silent
							}
							user.storage.set(valueName, argument / oldValue);
						});
					} else if (Helper.var.commands.leaderboard.includes(cmd) && Helper.run(this.other.leaderboard.allowed, args) === true) { // leaderboard
						let results = Object.values(args.customGuild.Users)
							.map(customUser => [args.guild.members.get(customUser.id) || null, customUser.storage.get(valueName, 0)])
							.filter(infoUser => Helper.isUser(infoUser[0], "discord")) // filter out null users
							.filter(infoUser => this.other.leaderboard.displayNonMembers || Helper.isMember(infoUser[0]))

						results.sort((numA, numB) => numB[1] - numA[1]); // sort it greatest to least
						return this.other.leaderboard.onLeaderboard(results.slice(0, this.other.leaderboard.entries), args);
					} else {
						return this.other.onError(Helper.var.Error.noCommand, argument, mentions, args);
					}
				} else {
					// This is more of an internal problem, since the type is wrong TODO: make this better
					return this.other.onError(Helper.var.Error.noCommand, argument, mentions, args);
				}

				return this.other.onModifiedValue(argument, mentions, args);
			}

			let command = new Command(name, run, other);

			this.addCommand(command);

			return command;
		}
		addCommand(...args) {
			if (Helper.isCommand(args[0])) {
				this.list.push(args[0]);
			} else {
				this.list.push(new Command(...args));
			}
			return true;
		}
		// #endregion add command
		// #region run command
		runCommandByName(name, args) {
			return this.runCommand(this.findCommand(name, false), args);
		}
		runCommand(command, args) {
			return command.run(args);
		}
		// #endregion run command
		// #region find command
		findCommand(value = null) {
			if (Helper.isCommand(value)) { // they want to find the index, since they have the command
				return this.findCommandByName(value.name, true);
			} else { // assumes it's a string TODO: don't do this+
				return this.findCommandByName(value, false);
			}
		}
		findCommandByName(name = "", getIndex = false) {
			this.list.filter(command => Helper.isCommand(command))
			for (let i = 0; i < this.list.length; i++) {
				if (Helper.isCommand(this.list[i])) {
					if (this.list[i].matchesName(name, false)) {
						if (getIndex) {
							return i; // returns the index that the command is in the list
						}
						return this.list[i];
					}
				}
			}
			return null;
		}
		// #endregion find command
		// #region remove command
		removeCommandByName(name = "") {
			let index = this.findCommand(name, true);
			return this.removeCommandByIndex(index);
		}
		removeCommandByIndex(index = -1) {
			if (index >= 0) {
				this.list.splice(index, 1);
				return true;
			}
			return false;
		}
		// #endregion remove command
	}
	class Guild {
		constructor(id = null) {
			this.id = id;
			this.settings = {};
			this.storage = new Storage(0);

			this.Users = {};

			this.Commands = new CommandList();
		}

		static fromData(data, id) {
			let guild = new Guild(id);

			if (Helper.isObject(data) && data.isValid === true) {
				guild.settings = data.settings;
				guild.storage = Storage.fromData(data.storage, 0);

				for (let i in data.Users) {
					guild.Users[i] = User.fromData(data.Users[i], data.Users[i].id);
				}
			}

			return guild;
		}

		getData() {
			let guild = {
				isValid: true,

				settings: {},
				storage: {},
				Users: {}
			};
			// REMINDER: Once you implement custom commands, make sure to save them
			guild.id = this.id; // not exactly needed
			guild.settings = this.settings || {}; // just directly copy it // TODO: do something better than this
			guild.storage = this.storage.getData();

			for (let i in this.Users) {
				guild.Users[i] = this.Users[i].getData();
			}

			return guild;
		}
		// #region user
		userExists(userID = null) {
			return this.isUser(this.Users[userID], "custom");
		}

		isUser(user = null, type = "custom") {
			return Helper.isUser(user, type);
		}

		createUser(userID = null, strict = true) {
			if (strict === true) {
				if (this.userExists(userID)) {
					return this.Users[userID];
				}
			}
			this.Users[userID] = new User(userID, this);
			return this.Users[userID];
		}

		getUserByID(userID = null) {
			return this.createUser(userID, true); // creates it if it doesn't exist, otherwise gets the user
		}

		getUser(user = null) {
			if (this.isUser(user, "discord")) {
				return this.getUserByID(user.id);
			} else if (this.isUser(user, "custom")) {
				return user; // it's already a user
			}
			return null;
		}
		// #endregion user
	}
	class Client {
		constructor(token = null) {
			this.client = new Discord.Client();
			this.listen = new EventEmitter();
			this.token = token;

			this.Guilds = {};

			this.Commands = new CommandList();

			this.defaultPrefix = "k!";

			// all of them should have a help command
			this.Commands.addCommand(["help", "h", "commands", "cmds"], async args => {
				let firstParameter = Helper.flatten(args.content[1]);
				if (Helper.isString(firstParameter) && firstParameter) {
					let command = args.Client.findCommand(firstParameter, args.customGuild);

					if (Helper.isCommand(command) && command.isAllowed(args, true)) { // be lenient
						args.reply(Helper.replaceKeyWords(command.getHelpText(args), args, firstParameter));
					} else {
						args.reply('Sorry, but that command was not found.');
					}
				} else {
					let prefix = args.prefix;

					let commands = Helper.divide(
						args.Client.Commands.list.concat(args.customGuild.Commands.list),
						command => Helper.isCommand(command)
					);

					if (commands[0].length > 0) { // if there's non-commands
						Log.warn(`There was ${commands[0].length} items inside the command list for the Client and/or the guild with the id: '${args.customGuild.id}'\nthat are not valid commands.`);
					}

					commands = commands[1].filter(command => command.isAllowed(args))
						.reduce((prev, cur) => {
							let group = Helper.precedence(cur.other.group, "Other");
							if (!prev.hasOwnProperty(group)) {
								prev[group] = [];
							}
							prev[group].push(cur);
							return prev;
						}, {});
					
					await args.send('**Commands**:\n' + Helper.precedence(this.helpPreface, "") + '\n');
					for (let group in commands) {
						let text = "";
						text += "**" + group + "**\n";
						if (Helper.isArray(commands[group])) {
							for (let i = 0; i < commands[group].length; i++) {
								text += `\`${Helper.replaceKeyWords(Helper.precedence(Helper.run(commands[group][i].other.helpCommand, args), prefix + commands[group][i].name[0]), args, commands[group][i].name[0])}\` - ${Helper.precedence(Helper.run(commands[group][i].other.description, args), "No Description Found")}\n`;
							}
						}
						args.send(text + "\n"); // they can be sent in whatever order
					}

					

					
				}
			}, {
				allowed: true,
				description: "Gets the list of commands.\n\tPut a command name after to get it's usage text.",
				usage: "`$prefix$commandname` acquires the list of commands\n`$prefix$commandname [command]` gets the help information for [command]`"
			});

			this.client.on('ready', _ => Log.info('Logged in'));

			this.client.on('message', message => {
				let {
					member,
					content,
					guild,
					channel
				} = message;

				// messages from self will show up as "ignoring message"
				// this is also *excessive* checking
				if (!(
						Helper.isMessage(message) && // makes sure this is a message
						Helper.isChannel(channel) && // makes sure this is a channel
						Helper.isTextChannel(channel) && // make sure this is a textchannel, not a DM/Voice/etc
						Helper.isGuild(guild, 'discord') && // make sure this is an actual guild, just in case
						guild.available === true && // make sure the guild isn't having an outage
						Helper.isString(content) && // make sure there's actual text
						Helper.isMember(member) && // make sure it's an actual member; leaving guild won't break it (hopefully)
						member.id !== this.client.user.id // ignore itself
					)) {
					return Log.info('ignoring message');
				}

				let customGuild = this.getGuild(guild);

				if (!Helper.isGuild(customGuild, "custom")) {
					// shouldn't send anything in a chat that there is an error, since it might not be a command
					return Log.warn("There was a problem with getting a custom guild from a guild. :(");
				}

				let customUser = customGuild.getUser(message.member);

				content = Parser.parse(content, true); // parses it in to an array, useful

				if (!Helper.isString(content[0])) { // make sure the first is a string
					return Log.warn(`Possible issue with Parser, as content[0] is not a string. It's value is: '${content[0]}'`);
				}

				this.listen.emit('pre:command-message', { // TODO: make this better so it repeats less
					content,
					message,
					customGuild,
					customUser,
					member,
					content,
					guild,
					channel,
					reply: message.reply.bind(message),
					send: message.channel.send.bind(message.channel)
				});

				let prefix = Helper.getPrefix(this, customGuild);

				if (!(
						Helper.isString(prefix) && // make sure the prefix exists
						message.content.startsWith(prefix) // make sure the text starts with the prefix, otherwise it isn't a command
					)) {
					return Log.info('ignoring non-command');
				}

				let commandName = content[0].substring(prefix.length).toLowerCase(); //gets the text after the prefix & make it lowercase
				let command = this.findCommand(commandName, customGuild);

				// DEBUG information
				console.table('content', content, 'prefix', prefix, 'commandName', commandName, 'command', command);

				let args = {
					Client: this, // this client

					commandName, // stores the name, especially as it's the one it was called with
					command, // the exact command being run

					message, // <Message> the message
					get prefix() { // so even if it updates while it's doing something it will update here. Is this even useful?
						return Helper.getPrefix(this, customGuild);
					},

					mentions: message.mentions, // <Collection> of mentions
					mentionsMembers: message.mentions.members.array(), // fine to keep it here since we ignore outside of textchannels

					customUser, // <User> Custom User Object for this user in this guild

					member, // <Discord.GuildMember> the author of the message
					memberID: member.id, // <ID> the id of the author of the message
					memberName: member.displayName, // <String> the name of the author of the message

					customGuild, // <Guild>

					guild, // <Discord.Guild>
					guildID: guild.id, // <ID>
					guildIcon: guild.iconURL, // <String>
					guildChannels: guild.channels, // <Collection{<ID>:<Discord.GuildChannel>}>
					guildEmotes: guild.emojis, // <Collection{<ID>:<Discord.Emoji>}>
					guildMembers: guild.members, // <Collection{<ID>:<Discord.GuildMember>}>
					guildName: guild.name, // <String> name of the guild
					guildOwnerMember: guild.owner, // <Discord.GuildMember> Owner of the guild
					guildRoles: guild.roles, // <Collection{<ID>:<Discord.Role>}>
					guildBan: guild.ban.bind(guild), // bans a user from the guild (needs-perms)

					channel, // <Discord.Channel> The channel the message was sent in
					channelID: message.channel.id, // <ID> The ID of the channel the message was sent in

					content, // <[String+|Self*]>
					Helper,
					command, // <Command>
					prefix, // <String>
					// functions
					isAvailable() {
						return guild.available;
					},
					reply: Helper.reply(message.channel.send.bind(message.channel), member), // replies with an @ to the member at the start (needs-perms)
					send: Helper.send(message.channel.send.bind(message.channel)), // sends a message to the same channel (needs-perms)
					clearReactions: message.clearReactions.bind(message), // clears all the reactions (needs-perms)
					createReactionCollector: message.createReactionCollector.bind(message), // collects any reactions that are added
					delete: message.delete.bind(message), // deletes the message (needs-perms)
					isMemberMentioned: message.isMemberMentioned.bind(message), // tells you if a member was mentioned, @role/@everyone/@member/@user
					isMentioned: message.isMentioned.bind(message), // checks if a #channel/@User/@Role/id was mentioned
					pin: message.pin.bind(message), // pins the messages (needs-perms)
					unpin: message.unpin.bind(message), // unpins the message (needs-perms)
					react: message.react.bind(message), // reacts with an emoji (string|Emoji|ReactionEmoji) (needs-perms)

				};

				if (!Helper.isCommand(command) || !command.isAllowed(args)) { // should work
					let allowedToTell = Helper.precedence(customGuild.settings.canTellNonCommand, "Sorry, but that is not a command.");

					if (allowedToTell === false) return;

					return message.reply(allowedToTell);
				}


				customGuild.Commands.runCommand(command, args);
			});
		}

		static fromData(data, token) {
			let client = new Client(token);

			if (Helper.isObject(data) && data.isValid === true) { // data.isValid is to make sure that it's not just an empty object
				client.prefix = data.prefix;

				for (let i in data.Guilds) {
					client.Guilds[i] = Guild.fromData(data.Guilds[i], data.Guilds[i].id);
				}
			}

			return client;
		}

		getData() { // function to get Data that should be stored
			let client = {
				isValid: true,

				prefix: this.defaultPrefix,

				Guilds: {}
			};
			for (let i in this.Guilds) {
				client.Guilds[i] = this.Guilds[i].getData();
			}
			return client;
		}

		login() {
			this.client.login(this.token).catch(reason => {
				throw new Error('Error on login: ' + reason);
			});
		}

		findCommand(thing, guild) {
			let command = this.Commands.findCommand(thing);

			if (!(
					Helper.isCommand(command) &&
					Helper.isGuild(guild)
				)) {
				command = guild.Commands.findCommand(thing);
			}

			return command || null;
		}


		// #region guild
		guildExists(guildID) {
			return this.isGuild(this.Guilds[guildID], "custom");
		}

		isGuild(guild, type = "custom") {
			return Helper.isGuild(guild, type);
		}

		createGuild(guildID, strict = true) { // does *not* care whether it already exists, it *will* overwrite the old
			if (strict === true) {
				if (this.guildExists(guildID)) {
					return this.Guilds[guildID];
				}
			}
			this.Guilds[guildID] = new Guild(guildID);
			return this.Guilds[guildID];
		}

		getGuildByID(guildID) {
			return this.createGuild(guildID, true);
		}

		getGuild(guild) {
			if (this.isGuild(guild, "discord")) {
				return this.getGuildByID(guild.id);
			} else if (this.isGuild(guild, "custom")) {
				return guild; // it's already a user
			}
			return null;
		}
		// #endregion guild
	}

	return {
		Discord,
		Client,
		Guild,
		User,
		Command,
		CommandList,
		Storage,
		Helper,
		Log
	};
}