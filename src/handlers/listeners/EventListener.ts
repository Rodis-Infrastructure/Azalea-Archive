export default abstract class EventListener {
    once: boolean;
    name: string;

    protected constructor(data: { name: string; once: boolean; }) {
        this.once = data.once;
        this.name = data.name;
    }
}