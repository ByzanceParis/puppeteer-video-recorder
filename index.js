const { FsHandler } = require('./handlers');
const { exec } = require('child_process');
const PuppeteerMassScreenshots = require('puppeteer-mass-screenshots');
const pathToFfmpeg = require('ffmpeg-static');

class PuppeteerVideoRecorder {
    constructor(){
        this.screenshots = new PuppeteerMassScreenshots();
        this.fsHandler = new FsHandler();
    }

    async init(page, outputFolder){
        this.page = page;
        this.outputFolder = outputFolder;
        await this.fsHandler.init(outputFolder);
        const { imagesPath,imagesFilename, appendToFile } = this.fsHandler;
        await this.screenshots.init(page, imagesPath, {
            afterWritingImageFile: (filename) => appendToFile(imagesFilename, `file '${filename}'\n`)
        });
    }             

    start(options = {}) { 
        return this.screenshots.start(options);
    }
    
    async stop () {
    	await this.screenshots.stop();
    	return this.createVideo();
    }

    get defaultFFMpegCommand() {
        const { imagesFilename, videoFilename } = this.fsHandler;
        return [
            pathToFfmpeg,
            '-f concat',
            '-safe 0',
            `-i ${imagesFilename}`,
            '-framerate 60',
            '-c:v', 
            'libx264',
            '-y', 
            '-vf', 
            'format=yuv420p',
            '-video_track_timescale', 
            '90000',
            videoFilename
        ].join(' ');
    }

    createVideo(ffmpegCommand = '') {
        const _ffmpegCommand = ffmpegCommand || this.defaultFFMpegCommand;
        const { videoFilename } = this.fsHandler;
        return new Promise((resolve, reject) => {
            exec(_ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }
                resolve(videoFilename);
            });
        })
    }


    concatVideo(toConcat, filename) {
        const { videoFilename, videosTxtFilename, appendToFile } = this.fsHandler;
        appendToFile(videosTxtFilename, `file '${toConcat}'\nfile '${videoFilename}'`)
        const command = [
            pathToFfmpeg,
            '-safe 0',
            '-f concat',
            '-segment_time_metadata 1',
            `-i ${videosTxtFilename}`,
            '-vf select=concatdec_select',
            '-af aselect=concatdec_select,aresample=async=1',
            filename
        ].join(' ');
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }
                resolve(videoFilename);
            });
        })
    }

}

module.exports = PuppeteerVideoRecorder;
