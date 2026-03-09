export function parseClientRealtimeMessage(rawMessage) {
    try {
        return JSON.parse(rawMessage);
    }
    catch {
        return null;
    }
}
