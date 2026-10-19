# Technical Decision: Hosting Summarist

### The Problem

Summarist is a React-based application designed to demonstrate user authentication, a database, and subscription functionality.

The project materials use Vercel as a deployment option. However, Vercel's free Hobby plan is restricted to personal, noncommercial use.

Although Summarist is currently an educational project, a real-world subscription application intended to generate revenue would need a hosting arrangement that permits commercial activity.

### My Solution

I chose to separate frontend hosting from backend services.

- **GitHub:** Source code and version control.
- **Vercel:** Frontend hosting for the noncommercial classroom demonstration.
- **Firebase:** User authentication and database services.
- **Payment testing:** Simulated or test-mode transactions without collecting actual payments.

For a commercial production release, I would either upgrade to a suitable Vercel plan or migrate the frontend to a hosting provider whose terms permit the intended commercial use.

### Why I Made This Decision

The purpose of a virtual internship is to apply development practices to realistic situations.

I wanted to ensure the application would not only function technically but also comply with the hosting provider's terms of service.

Vercel's Hobby plan is intended for personal, noncommercial projects. Its restrictions make it unsuitable for operating a revenue-generating subscription service.

**Reference:** [Vercel — Fair Use Guidelines](https://vercel.com/docs/concepts/limits/fair-use-policy)

By identifying this limitation during development, I can avoid potential compliance issues when moving from a classroom demonstration to a commercial application.

### Conclusion

A successful deployment requires more than working code. It also requires choosing services appropriate for the application's purpose, cost, security, and intended users.

This approach allows me to complete the educational assignment while documenting what would need to change before a real commercial launch.
