# Canvas Export Content Viewer
A better offline viewer for exported Canvas course content. This tool provides an improved experience over the default Canvas export interface, featuring dark mode, powerful search, keyboard navigation, and progress tracking.

## Getting Started
Follow these steps to view your Canvas course content offline:

### 1. Export your Canvas Course
First, you need to get your course data from Canvas:
1. Navigate to the course you want to export, and click on the Modules button (on the sidebar - some courses don't have this). 
2. Click the "Export Course Content" button. Once the export is finished, download and unzip the file.
3. Inside the unzipped folder, you will find a directory named `viewer`. This folder contains the `course-data.js` and all your course files.

> [!TIP]
> For help with exports, see the [official Canvas guide](https://community.instructure.com/en/kb/articles/660734-how-do-i-export-a-canvas-course).

### 2. Set up the Canvas Viewer
1. Download the latest `Canvas-Viewer.zip` from the [Releases](https://github.com/arastoof/Canvas-Export-Content-Viewer/releases) section of this repository.
2. Unzip the contents into a new folder on your computer. You should see an `index.html` file and a `canvas-viewer` folder.

### 3. Combine and View
1. Take the `viewer` folder you obtained in Part 1 and move (or copy) it into the folder where you unzipped the Canvas Viewer in Part 2.
2. Your directory structure should look like this:
   ```text
   ├── index.html
   ├── canvas-viewer/
   │   ├── app.js
   │   └── style.css
   └── viewer/              <-- Drop your exported folder here
       ├── course-data.js
       └── files/
   ```
3. Open `index.html` in your browser. 

## Features
- 🌓 **Dark & Light Modes**: Theme switching with persistent settings.
- 🔍 **Instant Search**: Quickly find modules and items within your course.
- ⌨️ **Keyboard Shortcuts**: Navigation for a faster workflow.
- ✅ **Progress Tracking**: Mark items as complete and see your progress.
- 📄 **PDF Integration**: Integrated PDF viewing and download options.

> [!NOTE]
> I have tested this only on a small amount of content. It's possible it won't work with other modules etc.
> I also have no association with Canvas; This is an unofficial tool.