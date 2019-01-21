#!/usr/bin/env node --harmony

const program = require('commander');
const inquirer = require('inquirer');
const Fetcher = require('../scripts/Fetcher');
const Parser = require('../scripts/Parser');
const Messager = require('../scripts/Messager');
const storage = require('node-persist');
const package = require('../package.json');
const keyStoreDir = './bin/store/keyStore';

(async function run() {
    const parser = new Parser();
    const keyStore = storage.create({ dir: keyStoreDir });

    await keyStore.init();

    program
        .version(package.version)
        .option('-K, --key', 'Figma project key')
        .option('-T, --token', 'Figma account token');

    program.command('clean').action(async function(cmd, options) {
        Messager.startCommand();
        await parser.clean();
        Messager.endCommand();
    });

    program.on('command:*', function() {
        console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
        process.exit(1);
    });

    program.parse(process.argv);

    if (program.args.length < 1) {
        Messager.startCommand();

        const keys = await keyStore.keys();
        const values = await keyStore.values();

        await keyStore.setItem('eIOdDEWeiHETuccK5xpfNhEc', {
            name: 'Sample icons',
            token: '6742-59554322-f562-4177-8848-f7125dce459a',
        });

        const keyChoices =
            keys.length > 0
                ? keys.reduce((a, k, i) => {
                      const val = values[i];
                      a.push({ name: `${val.name} (${k})`, value: k });
                      return a;
                  }, [])
                : [{ name: 'No saved project found', disabled: 'Create a new one below' }];

        const { key, token, selectedKey } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedKey',
                message: 'Select a saved Figma project, or a create new one',
                choices: [...keyChoices, new inquirer.Separator(), 'Create new'],
            },
            {
                type: 'input',
                name: 'key',
                message: 'Enter the file key of your Figma project',
                when: function(answers) {
                    return answers.selectedKey === 'Create new';
                },
            },
            {
                type: 'input',
                name: 'token',
                message: 'Enter a personal access token (leave blank if project is public)',
                when: function(answers) {
                    return answers.selectedKey === 'Create new';
                },
            },
        ]);

        let config = { key, token };

        if (key && token) {
            config.key = key;
            config.token = token;
        } else {
            const { token: selectedToken } = await keyStore.getItem(selectedKey);
            config.key = selectedKey;
            config.token = selectedToken;
        }

        const fetcher = new Fetcher({
            key: config.key,
            token: config.token,
        });

        try {
            const figmaData = await fetcher.getFigmaProject(config.key);

            await fetcher.grabImageData(figmaData);
            await parser.clean();
            await parser.parse();
            await keyStore.setItem(config.key, {
                name: figmaData.name,
                token: config.token,
            });
        } catch (error) {
            Messager.log(error.message);
        }

        Messager.endCommand();
    }
})();
