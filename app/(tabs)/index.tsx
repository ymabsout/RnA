import * as Sharing from 'expo-sharing';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import {
  Alert,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

export default function App() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [galleryPermission, requestGalleryPermission] = MediaLibrary.usePermissions();
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  if (!permission || !galleryPermission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionMessage}>
            We need your permission to show the camera.
          </Text>
          <Button onPress={requestPermission} title="Grant Permission" />
        </View>
      </View>
    );
  }

  if (!galleryPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionMessage}>
            We need your permission to access the gallery.
          </Text>
          <Button onPress={requestGalleryPermission} title="Grant Permission" />
        </View>
      </View>
    );
  }
  function toggleCameraFacing() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }

  async function takePicture() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        const asset = await MediaLibrary.createAssetAsync(photo.uri);
        await MediaLibrary.createAlbumAsync('My Photos', asset, false);
        Alert.alert('Photo Saved', 'Photo saved to gallery!');
      } catch (error) {
        Alert.alert('Error', 'Failed to take photo');
        console.error(error);
      }
    }
  }

  async function selectPhotosFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10, // Limit number of images
      });

      if (!result.canceled && result.assets) {
        const selectedUris = result.assets.map((asset) => asset.uri);
        setSelectedPhotos(selectedUris);
        Alert.alert('Photos Selected', `You selected ${selectedUris.length} photos.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select photos from the gallery');
      console.error(error);
    }
  }

  async function createPdfAndSave() {
    if (selectedPhotos.length === 0) {
      Alert.alert('No Photos', 'Please select photos from the gallery to create a PDF.');
      return;
    }

    try {
      const base64Images = await Promise.all(
        selectedPhotos.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `data:image/jpeg;base64,${base64}`;
        })
      );

      const htmlContent = base64Images
        .map(
          (base64) =>
            `<img src="${base64}" style="width:100%; height:auto; margin-bottom:10px;" />`
        )
        .join('');

      const { uri: pdfUri } = await Print.printToFileAsync({
        html: `<html><body>${htmlContent}</body></html>`,
      });

      const pdfFilePath = `${FileSystem.documentDirectory}photos.pdf`;

      await FileSystem.moveAsync({
        from: pdfUri,
        to: pdfFilePath,
      });

      setPdfPath(pdfFilePath);
      Alert.alert('PDF Created', `PDF saved to: ${pdfFilePath}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create PDF.');
      console.error(error);
    }
  }

  async function sharePdf() {
    if (!pdfPath) {
      Alert.alert('No PDF Found', 'Please create a PDF before sharing.');
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'This device does not support sharing.');
        return;
      }
      await Sharing.shareAsync(pdfPath);
    } catch (error) {
      Alert.alert('Error', 'Failed to share the PDF.');
      console.error(error);
    }
  }

  async function sendPdf() {
    if (!pdfPath) {
      Alert.alert('No PDF Found', 'Please create a PDF before sending.');
      return;
    }
  
    try {
      // Read the PDF file as Base64
      const pdfData = await FileSystem.readAsStringAsync(pdfPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      // API endpoint and headers
      const API_ENDPOINT = 'api.scantofhir.com '; // Replace with your actual endpoint
      const API_KEY = 'your-api-key-here'; // Replace with your actual API key
  
      // Send the POST request
      const response = await axios.post(
        API_ENDPOINT,
        { file: pdfData }, // Request body
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`, // Include the API key in the header
          },
        }
      );
  
      // Handle success
      Alert.alert('Success', 'PDF uploaded successfully!');
      console.log('Response:', response.data);
    } catch (error) {
      // Handle errors
      Alert.alert('Error', 'Failed to upload PDF.');
      console.error('Upload Error:', error.response?.data || error.message);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
      >
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Text style={styles.text}>Take Picture</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Text style={styles.text}>Flip Camera</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
  
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={selectPhotosFromGallery}>
          <Text style={styles.actionText}>Select Photos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={createPdfAndSave}>
          <Text style={styles.actionText}>Create PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={sendPdf}>
          <Text style={styles.actionText}>Send PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={sharePdf}>
          <Text style={styles.actionText}>Share PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#f0f0f0',
  },
  camera: {
    flex: 2,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  actionButtons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
  },
  actionButton: {
    width: '40%',
    marginVertical: 10,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center', // Vertically center
    alignItems: 'center', // Horizontally center
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dimmed background
  },
  permissionBox: {
    width: '80%', // Adjust box size
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#fff', // White background for visibility
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  permissionMessage: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
});