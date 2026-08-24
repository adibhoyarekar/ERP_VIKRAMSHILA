export const RATE_LIMITS = {
  auth: {
    maxAttempts: 5,
    baseBackoffSeconds: 30, // 30s, 60s, 120s, 240s...
    actionType: 'auth'
  },
  public: {
    maxAttempts: 20,
    baseBackoffSeconds: 10, // 10s, 20s, 40s...
    actionType: 'public'
  },
  protected: {
    maxAttempts: 100,
    baseBackoffSeconds: 5, // 5s, 10s, 20s...
    actionType: 'protected'
  }
};
