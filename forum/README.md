# Forum App

A modern web-based forum application built with React, TypeScript, and Vite. This project allows users to create accounts, post topics, comment on posts, and vote on content.

## Features

- **User Authentication**: Secure login and registration system
- **Post Management**: Create, view, and manage forum posts
- **Commenting System**: Add comments to posts with threaded discussions
- **Voting System**: Upvote and downvote posts and comments
- **Theme Toggle**: Switch between light and dark themes
- **Responsive Design**: Optimized for desktop and mobile devices
- **Protected Routes**: Secure access to authenticated features

## Tech Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Custom CSS with theme support
- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **Hosting**: Vercel

## Live Demo

Visit the live application at: [https://forum-chi-eight.vercel.app/](https://forum-chi-eight.vercel.app/)

## Database Schema

The database schema is defined in `schema.sql` and includes the following tables:

- `users`: User account information
- `posts`: Forum posts with titles and content
- `comments`: Comments on posts
- `votes`: User votes on posts and comments

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── CommentItem.tsx
│   ├── CommentList.tsx
│   ├── Navbar.tsx
│   ├── NewCommentForm.tsx
│   ├── NewPostForm.tsx
│   ├── PostDetail.tsx
│   ├── PostList.tsx
│   ├── ProtectedRoute.tsx
│   ├── ThemeToggle.tsx
│   └── VoteButtons.tsx
├── contexts/            # React contexts
│   └── ThemeContext.tsx
├── lib/                 # Library configurations
│   └── supabase.ts
├── pages/               # Page components
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── NewPostPage.tsx
│   ├── PostDetailPage.tsx
│   └── Register.tsx
├── types/               # TypeScript type definitions
│   └── index.ts
└── utils/               # Utility functions
    └── supabase.ts
```

## Available Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the project for production
- `npm run preview`: Preview the production build locally
- `npm run lint`: Run ESLint for code quality checks

## Deployment

This application is hosted on Vercel. To deploy your own version:

1. Connect your GitHub repository to Vercel
2. Add the environment variables in the Vercel dashboard
3. Deploy automatically on push to main branch

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request
