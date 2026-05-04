/**
 * Web fallback for react-native-image-picker.
 * Uses an HTML file input to pick images.
 */

export function launchImageLibrary(options) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve({ didCancel: true });
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({
        didCancel: false,
        assets: [
          {
            uri,
            fileName: file.name,
            type: file.type,
            fileSize: file.size,
          },
        ],
      });
    };
    input.click();
  });
}
