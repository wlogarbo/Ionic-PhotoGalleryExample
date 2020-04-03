import { Injectable } from '@angular/core';
import { Plugins, CameraResultType, Capacitor, FilesystemDirectory, 
  CameraPhoto, CameraSource, FilesystemPluginWeb } from '@capacitor/core';
import { JsonPipe } from '@angular/common';
import { Platform } from '@ionic/angular'


const { Camera, Filesystem, Storage } = Plugins;

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos : Photo[] = [];
  private PHOTO_STORAGE: string = "photos";
  private platform: Platform;

  constructor(platform: Platform) { 
    this.platform = platform;
  }

  public async addNewToGallery() {
    // Take a photo
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri, 
      source: CameraSource.Camera, 
      quality: 100 
    });

    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);

    Storage.set({
      key: this.PHOTO_STORAGE,
      value: this.platform.is('hybrid')
        ? JSON.stringify(this.photos)
        : JSON.stringify(this.photos.map(p => {
        const photoCopy = { ...p };
        delete photoCopy.base64;

        return photoCopy;
      }))
    })
  }

  public async loadSaved() {
    const photos = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photos.value) || [];

    if(!this.platform.is('hybrid')) {
      for(let photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filePath,
          directory: FilesystemDirectory.Data
        });
        
      photo.base64 = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  private async savePicture(cameraPhoto: CameraPhoto) {
    const base64Data = await this.readAsBase64(cameraPhoto);

    const fileName = new Date().getTime() + '.jpeg';
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    return await this.getPhotoFile(cameraPhoto, fileName);
  }

  private async readAsBase64(cameraPhoto: CameraPhoto){
    if(this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: cameraPhoto.path
      });
      
      return file.data;
    }
    else {
      const response = await fetch(cameraPhoto.webPath!);
      const blob = await response.blob();
  
      return await this.convertBlobToBase64(blob) as string;
    }
  }

  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

  private async getPhotoFile(cameraPhoto: CameraPhoto, fileName: string): Promise<Photo> {
    if(this.platform.is('hybrid')) {
      const fileUri = await Filesystem.getUri({
        directory: FilesystemDirectory.Data,
        path: fileName
      });

      return {
        filePath: fileUri.uri,
        webviewPath: cameraPhoto.webPath
      };
    }
    else {
      return {
        filePath: fileName,
        webviewPath: cameraPhoto.webPath
      }
    };
  }
}

interface Photo {
  filePath : string;
  webviewPath : string;
  base64? : string;
}
