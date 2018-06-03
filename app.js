const fetch = require('node-fetch');
const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');

let listings = null;

const getListings = () => {
	return new Promise((resolve, reject) => {
		fetch('https://api.coinmarketcap.com/v2/listings/')
			.then(response => response.json())
			.then(json => {resolve(json.data)})
			.catch(error => {reject(config.lang.noListings)});
	});
};

const getIdBySymbol = (symbol) => {
	return new Promise((resolve, reject) => {
		if (!symbol) reject(config.lang.noSymbol);

		if (!listings) reject(config.lang.noListings);

		for (let listing of listings) {
			if (listing.symbol.toLowerCase() !== symbol.toLowerCase()) continue;

			resolve(listing.id);
		}

		reject(config.lang.invalidSymbol);
	});
};

const getDataById = (id) => {
	return new Promise((resolve, reject) => {
		if (!rateLimiter.isWithinLimit()) reject(config.lang.tooManyRequests);

		rateLimiter.increment();

		fetch(`https://api.coinmarketcap.com/v2/ticker/${id}/`)
			.then(response => response.json())
			.then(json => {resolve(json.data)})
			.catch(error => {reject(config.lang.noData)});
	});
};

const formatPrice = (price) => {
	var parts = price.toString().split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	return `$${parts.join('.')}`;
};

const formatDelta = (delta) => {
	if (delta >= 0) {
		delta = `+${delta}`;
	}

	return `${delta}%`;
};

const getColor = (delta) => {
	return delta >= 0 ? config.uiColors.positive : config.uiColors.negative;
};

const printData = (channel, data) => {
	channel.send({
		embed: {
			color: getColor(data.quotes.USD.percent_change_24h),
			title: `${data.rank}. ${data.name} (${data.symbol})`,
			description: `${formatPrice(data.quotes.USD.price)}`,
			footer: {
				text: `${formatDelta(data.quotes.USD.percent_change_24h)}`,
			},
		},
	});
};

const printHelp = (channel) => {
	channel.send({
		embed: {
			color: config.uiColors.neutral,
			title: config.lang.helpTitle,
			fields: config.lang.helpFields,
		},
	});
};

const printMessage = (channel, userId, message) => {
	channel.send(`<@${userId}> ${message}`);
};

const rateLimiter = {
	limit: config.rateLimiter.limit,
	timespan: config.rateLimiter.timespan,
	count: 0,
	start: () => {
		setTimeout(rateLimiter.end, rateLimiter.timespan);
	},
	end: () => {
		rateLimiter.count = 0;
	},
	isWithinLimit: () => {
		return rateLimiter.count < rateLimiter.limit;
	},
	increment: () => {
		if (rateLimiter.count === 0) {
			rateLimiter.start();
		}

		rateLimiter.count++;
	},
};

client.on('ready', () => {
	getListings()
		.then(data => {listings = data})
		.catch(error => {console.log(error)});
});

client.on('message', async message => {
	if (message.author.bot) return;

	if (message.content.indexOf(config.commandPrefix) !== 0) return;

	const userId = message.author.id;
	const channel = message.channel;
	const args = message.content.slice(config.commandPrefix.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();

	switch (command) {
		case 'help':
			printHelp(channel);

			break;
		case 'price':
			getIdBySymbol(args[0])
				.then(id => getDataById(id))
				.catch(error => {throw error})
				.then(data => {printData(channel, data)})
				.catch(error => {printMessage(channel, userId, error)});

			break;
	}
});

client.login(config.botToken);
