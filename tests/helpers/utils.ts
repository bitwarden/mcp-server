export function setUpTests(): void {
  beforeAll(() => {
    process.env.BW_SESSION = 'session';
  });
}
