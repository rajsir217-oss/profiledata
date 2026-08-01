import os
import pickle
import requests
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import time

# Combined scopes for upload and reading app-created data
# 'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata'
#     'https://www.googleapis.com/auth/photoslibrary.appendonly',
# 'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
SCOPES = [

    'https://www.googleapis.com/auth/photoslibrary.readonly',
]

TOKEN_PICKLE = 'token_combined.pickle'

def authenticate():
    creds = None
    if os.path.exists(TOKEN_PICKLE):
        with open(TOKEN_PICKLE, 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=8080)
        with open(TOKEN_PICKLE, 'wb') as token:
            pickle.dump(creds, token)
    return creds

def upload_photo(file_path, creds):
    print(f"Uploading photo: {file_path}")

    upload_url = 'https://photoslibrary.googleapis.com/v1/uploads'
    headers = {
        'Authorization': f'Bearer {creds.token}',
        'Content-type': 'application/octet-stream',
        'X-Goog-Upload-File-Name': os.path.basename(file_path),
        'X-Goog-Upload-Protocol': 'raw',
    }

    with open(file_path, 'rb') as f:
        file_bytes = f.read()

    upload_response = requests.post(upload_url, headers=headers, data=file_bytes)

    if upload_response.status_code != 200:
        print(f"Failed to upload photo data: {upload_response.status_code} - {upload_response.text}")
        return None

    upload_token = upload_response.text
    print(f"Upload token received: {upload_token}")

    create_url = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate'
    create_headers = {
        'Authorization': f'Bearer {creds.token}',
        'Content-type': 'application/json',
    }

    new_item = {
        "newMediaItems": [
            {
                "description": "Uploaded by combined script",
                "simpleMediaItem": {
                    "uploadToken": upload_token
                }
            }
        ]
    }

    create_response = requests.post(create_url, headers=create_headers, json=new_item)

    if create_response.status_code != 200:
        print(f"Failed to create media item: {create_response.status_code} - {create_response.text}")
        return None

    print("Photo uploaded and media item created successfully.")
    return create_response.json()

def list_app_created_photos(creds):
    print("\nListing photos uploaded by this app...")

    headers = {
        'Authorization': f'Bearer {creds.token}',
        'Content-Type': 'application/json'
    }

    photos = []
    next_page_token = None

    while True:
        body = {
            'pageSize': 50,
        }
        if next_page_token:
            body['pageToken'] = next_page_token

        response = requests.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:search',
            headers=headers,
            json=body
        )

        if response.status_code != 200:
            print(f"Error fetching photos: {response.status_code} - {response.text}")
            break

        data = response.json()
        items = data.get('mediaItems', [])
        photos.extend(items)

        next_page_token = data.get('nextPageToken')
        if not next_page_token:
            break

    if not photos:
        print("No photos found in app-created data.")
    else:
        print(f"Found {len(photos)} photo(s):")
        for item in photos:
            print(f" - {item.get('filename', 'Unnamed')}")

    return photos

if __name__ == '__main__':
    creds = authenticate()

    # Replace this with your photo path
    photo_path = 'your_photo.jpg'

    if not os.path.isfile(photo_path):
        print(f"Error: File not found - {photo_path}")
    else:
        upload_photo(photo_path, creds)

        # Pause briefly to let Google process the new photo
        time.sleep(2)

        list_app_created_photos(creds)
