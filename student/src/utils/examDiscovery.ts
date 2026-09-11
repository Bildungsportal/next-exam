/** Replaces discovered exams while retaining manually found exams. */
export function mergeDiscoveredExams(discovered, manual = []) {
    return [...discovered, ...manual].filter((server, index, servers) =>
        servers.findIndex(candidate => candidate.id === server.id) === index
    );
}
