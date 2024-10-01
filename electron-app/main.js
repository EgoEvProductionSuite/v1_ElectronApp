// main/main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

// Function to create the main application window
function createWindow() {
  console.log('__dirname:', __dirname); // Add this line for debugging

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));


  // Open DevTools (optional)
  // mainWindow.webContents.openDevTools();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
}

// When Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS, recreate a window when the dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle IPC from renderer process to fetch charger data
ipcMain.handle('get-charger-data', async () => {
  return new Promise((resolve, reject) => {
    // Spawn the Python script
    pythonProcess = spawn(
      path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe'), // Adjust path if using different OS
      [path.join(__dirname, '..', 'python-scripts', 'charger_api.py')] // Python script path
    );

    let data = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    // Collect errors from stderr
    pythonProcess.stderr.on('data', (chunk) => {
      errorData += chunk.toString();
    });

    // On process exit
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${errorData}`));
      } else {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (err) {
          reject(new Error(`Failed to parse Python script output: ${err.message}`));
        }
      }
    });
  });
});

// Spawn Python script in monitor mode and handle real-time updates
ipcMain.on('start-monitoring', () => {
  if (pythonProcess) return; // Already running

  pythonProcess = spawn(
    path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe'), // Adjust path if using different OS
    [path.join(__dirname, '..', 'python-scripts', 'charger_api.py'), '--monitor'] // Python script path with --monitor flag
  );

  // Listen to stdout for real-time updates
  pythonProcess.stdout.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      mainWindow.webContents.send('charger-data', message);
    } catch (err) {
      console.error('Failed to parse Python stdout:', err);
    }
  });

  // Listen to stderr for errors
  pythonProcess.stderr.on('data', (data) => {
    console.error('Python stderr:', data.toString());
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null;
  });
});

// Start monitoring when the app is ready
app.whenReady().then(() => {
  ipcMain.emit('start-monitoring');
});
