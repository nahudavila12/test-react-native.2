export function addLog(setLogs, msg) {
  setLogs(prev => [...prev, msg]);
}
