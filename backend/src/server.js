import app from './app.js';
import { warmGoogleIdentityService } from './services/authService.js';

const port = Number(process.env.PORT) || 5000;
const server = app.listen(port);

server.once('listening', () => {
  console.log(`PlaceNexus API is listening on http://localhost:${port}`);
  void warmGoogleIdentityService();
});

server.once('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
  } else {
    console.error(`Unable to start PlaceNexus API: ${error.message}`);
  }
  process.exitCode = 1;
});
