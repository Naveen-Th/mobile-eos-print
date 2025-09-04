# Thermal Receipt Printer - Desktop Application

A cross-platform desktop application built with Electron, React, TypeScript, Tailwind CSS, and Firebase for managing thermal receipt printing.

## Features

- 🔐 **Firebase Authentication** - Secure login/logout with email/password
- 🎨 **Modern UI** - Beautiful interface built with Tailwind CSS
- 💻 **Cross-Platform** - Runs on Windows, macOS, and Linux
- 🔄 **Offline Support** - Works offline with local storage fallback
- 🖨️ **Printer Integration** - Ready for thermal printer connectivity
- 📱 **Shared Codebase** - Reuses services from the React Native mobile app

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Navigate to the desktop directory:
```bash
cd desktop
```

2. Install dependencies:
```bash
npm install
```

### Development

1. Build the application:
```bash
npm run build
```

2. Start the Electron app:
```bash
npm start
```

For development with hot reload:
```bash
npm run dev
```

### Building for Distribution

Build platform-specific installers:
```bash
npm run dist
```

## Project Structure

```
desktop/
├── src/
│   ├── components/          # React components
│   │   └── DesktopLoginForm.tsx
│   ├── services/           # Desktop-specific services
│   │   └── DesktopAuthService.ts
│   ├── config/             # Configuration files
│   │   └── firebase.ts
│   ├── types/              # TypeScript type definitions
│   ├── styles.css          # Tailwind CSS styles
│   ├── DesktopApp.tsx      # Main app component
│   ├── index.tsx           # React entry point
│   └── index.html          # HTML template
├── main.js                 # Electron main process
├── preload.js             # Electron preload script
├── webpack.config.js      # Build configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## Architecture

### Shared Services Integration

The desktop app leverages shared services from the `../shared/` directory:

- **Authentication**: Uses `FirebaseAuthService` adapted for desktop environment
- **Platform Detection**: Integrates with the platform abstraction layer
- **Type Definitions**: Shares TypeScript interfaces and types

### Desktop-Specific Features

- **Electron IPC**: Secure communication between main and renderer processes
- **Native Notifications**: Desktop notifications for user feedback
- **Offline Storage**: Local storage for offline functionality
- **Window Management**: Custom window controls and management
- **Platform Integration**: OS-specific features and capabilities

## Authentication

The app uses Firebase Authentication with the following features:

- Email/password login
- Password reset functionality
- Offline authentication fallback
- User role management (admin, cashier, viewer)
- Session persistence

### Demo Account

You can use the "Try Demo Account" button on the login form for testing.

## Styling

The application uses Tailwind CSS with a custom design system:

- **Color Palette**: Primary, secondary, success, danger, warning
- **Typography**: Inter font family with consistent sizing
- **Components**: Pre-built button, input, card, and form components
- **Responsive Design**: Optimized for desktop screen sizes
- **Dark Mode**: Ready for dark mode implementation

## Development Workflow

1. **Code Changes**: Edit files in `src/`
2. **Build**: Run `npm run build` to compile
3. **Test**: Run `npm start` to launch Electron app
4. **Debug**: Use Chrome DevTools (opens automatically in development)

## Firebase Configuration

The app uses the same Firebase project as the mobile app. Configuration is in:
- `src/config/firebase.ts` - Desktop-specific Firebase setup
- `../shared/config/firebase.ts` - Shared configuration

## Build System

- **Webpack**: Bundles the React application
- **TypeScript**: Type-safe development
- **PostCSS**: Processes Tailwind CSS
- **Electron Builder**: Creates platform-specific installers

## Available Scripts

- `npm start` - Launch the Electron app
- `npm run build` - Build for production
- `npm run build:watch` - Build with file watching
- `npm run dev` - Development mode with hot reload
- `npm run dist` - Create platform installers

## Platform Support

- **macOS**: Tested on macOS 13+
- **Windows**: Compatible with Windows 10+
- **Linux**: Supports Ubuntu, Debian, and other distributions

## Security

- Content Security Policy (CSP) configured
- Node.js integration disabled in renderer
- Context isolation enabled
- Secure IPC communication
- Firebase security rules applied

## Troubleshooting

### Common Issues

1. **White Screen**: Check console for errors, ensure Firebase configuration is correct
2. **Build Errors**: Clear `dist/` folder and rebuild
3. **Auth Issues**: Verify Firebase configuration and internet connection
4. **Performance**: Check bundle size, consider code splitting for large features

### Debug Mode

Run with debug output:
```bash
DEBUG=* npm start
```

## Future Enhancements

- [ ] Thermal printer driver integration
- [ ] Receipt template designer
- [ ] Multi-store management
- [ ] Data export functionality
- [ ] Auto-updater implementation
- [ ] Dark mode theme
- [ ] Keyboard shortcuts
- [ ] System tray integration

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Update tests for changes
4. Update documentation as needed

## License

MIT License - see LICENSE file for details.