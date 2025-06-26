export function setUpTests(): void {
  beforeEach(() => {
    process.env.BW_SESSION = 'session';
  });
}
