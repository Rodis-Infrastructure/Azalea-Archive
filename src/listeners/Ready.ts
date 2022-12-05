import EventListener from "../handlers/listeners/EventListener";
import Bot from "../Bot";

module.exports = class ReadyEventListener extends EventListener {
    constructor(client: Bot) {
        super(client, {
            name: "ready",
            once: true
        });
    }

    public async execute(client: Bot) {
        console.log(`${client.user?.tag} is online!`);

        await client.buttons.load();

        await client.commands.load();
        await client.commands.publish();
    }
};