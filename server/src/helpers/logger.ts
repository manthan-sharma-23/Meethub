export function logger(event: string, data: any) {
  console.log(`${event} :: ${JSON.stringify(data)}`);
}
