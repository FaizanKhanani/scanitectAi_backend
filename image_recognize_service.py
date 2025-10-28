# from flask import Flask, request, jsonify
# import tensorflow as tf
# import tensorflow_hub as hub
# import numpy as np
# from PIL import Image
# import io
# import json
# import requests

# app = Flask(__name__)

# # -------------------------------
# # Load GLDv2 Pretrained Model
# # -------------------------------
# print("🔄 Loading Google Landmarks V2 model (EfficientNet)...")
# model_url = "https://tfhub.dev/google/landmarks/efficientnet_v4/1"
# model = hub.load(model_url)
# print("✅ Model loaded successfully!")

# # Load label map (maps class IDs → names)
# label_url = "https://raw.githubusercontent.com/tensorflow/models/master/research/delf/delf/python/examples/google_landmarks_label_map.json"
# label_map = requests.get(label_url).json()

# def preprocess_image(image: Image.Image):
#     image = image.resize((321, 321))
#     img_array = np.array(image) / 255.0
#     return np.expand_dims(img_array, axis=0).astype(np.float32)

# @app.route("/")
# def home():
#     return jsonify({"message": "Google Landmarks API is running ✅"})

# @app.route("/recognize", methods=["POST"])
# def recognize():
#     if "file" not in request.files:
#         return jsonify({"error": "Please upload an image using key 'file'"}), 400

#     # Load and preprocess image
#     file = request.files["file"]
#     image = Image.open(io.BytesIO(file.read())).convert("RGB")
#     input_tensor = preprocess_image(image)

#     # Run inference
#     outputs = model(input_tensor)
#     probs = tf.nn.softmax(outputs["predictions"][0]).numpy()

#     # Get top predictions
#     top_k = probs.argsort()[-3:][::-1]
#     results = []
#     for idx in top_k:
#         landmark_id = str(idx)
#         landmark_name = label_map.get(landmark_id, f"Unknown ({idx})")
#         results.append({
#             "id": int(idx),
#             "name": landmark_name,
#             "confidence": float(probs[idx])
#         })

#     return jsonify({
#         "top_prediction": results[0],
#         "alternatives": results[1:]
#     })

# if __name__ == "__main__":
#     print("🚀 Flask server started at http://127.0.0.1:5000")
#     app.run(host="0.0.0.0", port=5000)































# from flask import Flask, request, jsonify
# import numpy as np
# from math import radians
# from PIL import Image
# import io
# import torch
# import torch.nn.functional as F
# import timm
# from timm.data import resolve_data_config
# from timm.data.transforms_factory import create_transform

# app = Flask(__name__)

# # -------------------------
# # Load DINOv2 (via timm)
# # -------------------------
# device = "cuda" if torch.cuda.is_available() else "cpu"
# model = timm.create_model("vit_base_patch14_dinov2", pretrained=True)
# model.eval().to(device)
# cfg = resolve_data_config({}, model=model)
# transform = create_transform(**cfg)

# def embed_image(pil_img):
#     x = transform(pil_img).unsqueeze(0).to(device)
#     with torch.no_grad():
#         feats = model.forward_features(x)
#         feats = model.forward_head(feats, pre_logits=True)  # global embedding
#         feats = F.normalize(feats, dim=-1)
#     return feats.cpu().numpy().astype("float32")  # shape (1, d)

# # -------------------------
# # Dummy reference data
# # Replace with your real DB and precomputed embeddings
# # -------------------------
# ref_meta = [
#     {"id": 1, "name": "Building A", "lat": 37.7749, "lon": -122.4194},
#     {"id": 2, "name": "Building B", "lat": 34.0522, "lon": -118.2437},
# ]
# # ref_vectors = np.load("ref_vectors.npy").astype("float32")  # shape (N, d), L2-normalized
# # For demo: random but normalized vectors (do NOT use in prod)
# np.random.seed(0)
# ref_vectors = np.random.randn(len(ref_meta), 768).astype("float32")
# ref_vectors /= np.linalg.norm(ref_vectors, axis=1, keepdims=True) + 1e-8

# EARTH_R = 6371000.0

# def haversine_vec(lat, lon, lats, lons):
#     # Vectorized haversine (meters)
#     lat1, lon1 = np.radians(lat), np.radians(lon)
#     lat2, lon2 = np.radians(lats), np.radians(lons)
#     dlat = lat2 - lat1
#     dlon = lon2 - lon1
#     a = np.sin(dlat/2)**2 + np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2)**2
#     return 2*EARTH_R*np.arcsin(np.sqrt(a))

# def choose_radius(accuracy_m):
#     # heuristic radius = clamp(accuracy*5, 0.5km..5km)
#     if accuracy_m is None:
#         return 2000
#     try:
#         acc = float(accuracy_m)
#     except:
#         return 2000
#     return float(np.clip(acc * 5.0, 500, 5000))

# def score_with_geo(cos_sim, dist_m, tau=800):
#     # combine cos_sim ([-1..1]) with distance prior (0..1)
#     geo_prior = np.exp(-dist_m / float(tau))
#     return 0.7 * cos_sim + 0.3 * geo_prior

# def safe_float(x):
#     try:
#         return float(x)
#     except:
#         return None

# def parse_input(request):
#     """
#     Returns:
#       query_vec: np.ndarray shape (1, d) float32 or None
#       lat, lon: float or None
#       accuracy: float or None
#     Also returns pil_img if file was provided (for embedding).
#     """
#     pil_img = None
#     lat = lon = accuracy = None
#     query_vec = None

#     if request.is_json:
#         data = request.get_json(silent=True) or {}
#         # JSON mode: expect query_vec (list) or base64 image if you add it later
#         qv = data.get("query_vec")
#         if qv is not None:
#             qv = np.array(qv, dtype=np.float32).reshape(1, -1)
#             # normalize to cosine space
#             qv /= (np.linalg.norm(qv, axis=1, keepdims=True) + 1e-8)
#             query_vec = qv
#         lat = safe_float(data.get("lat"))
#         lon = safe_float(data.get("lon"))
#         accuracy = safe_float(data.get("accuracy"))
#     else:
#         # multipart/form-data mode
#         # file
#         f = request.files.get("file") or request.files.get("image")
#         if f:
#             pil_img = Image.open(io.BytesIO(f.read())).convert("RGB")
#         # coordinates can be named latitude/longitude (RN) or lat/lon
#         form = request.form
#         lat = safe_float(form.get("latitude", form.get("lat")))
#         lon = safe_float(form.get("longitude", form.get("lon")))
#         accuracy = safe_float(form.get("accuracy"))
#         # optionally accept query_vec in form as JSON string
#         qv = form.get("query_vec")
#         if qv:
#             try:
#                 arr = np.array(eval(qv), dtype=np.float32).reshape(1, -1)
#                 arr /= (np.linalg.norm(arr, axis=1, keepdims=True) + 1e-8)
#                 query_vec = arr
#             except Exception:
#                 pass

#     return query_vec, lat, lon, accuracy, pil_img

# def retrieve(query_vec, lat=None, lon=None, accuracy=None, top_k=10):
#     # cosine similarity (ref_vectors and query_vec must be L2-normalized)
#     sims = (ref_vectors @ query_vec.T).ravel()  # shape (N,)

#     # Geo filter/prior
#     indices = np.arange(len(ref_meta))
#     if lat is not None and lon is not None:
#         cand_lats = np.array([c["lat"] for c in ref_meta])
#         cand_lons = np.array([c["lon"] for c in ref_meta])
#         dists = haversine_vec(lat, lon, cand_lats, cand_lons)
#         radius = choose_radius(accuracy)
#         mask = dists <= radius
#         if mask.any():
#             idx = indices[mask]
#             sims_m = sims[mask]
#             dists_m = dists[mask]
#             scored = score_with_geo(sims_m, dists_m)
#             order = np.argsort(-scored)
#             idx = idx[order]
#             sims_m = sims_m[order]
#             idx = idx[:top_k]
#             sims_m = sims_m[:top_k]
#             return idx, sims_m
#         # else: fallback to global visual-only

#     # Visual-only fallback
#     order = np.argsort(-sims)
#     idx = order[:top_k]
#     sims_top = sims[idx]
#     return idx, sims_top

# @app.route("/")
# def home():
#     return jsonify({"message": "Flask server is running ✅"})

# @app.route("/recognize", methods=["POST"])
# def recognize():
#     query_vec, lat, lon, accuracy, pil_img = parse_input(request)

#     # If no query_vec provided, we need the image file to compute it
#     if query_vec is None:
#         if pil_img is None:
#             return jsonify({"error": "Provide either multipart file (key 'file') or JSON 'query_vec'"}), 400
#         query_vec = embed_image(pil_img)  # (1, d)

#     idx, sims = retrieve(query_vec, lat=lat, lon=lon, accuracy=accuracy, top_k=10)

#     results = []
#     for i, s in zip(idx, sims):
#         meta = ref_meta[int(i)]
#         results.append({
#             "id": meta["id"],
#             "name": meta["name"],
#             "lat": meta["lat"],
#             "lon": meta["lon"],
#             "score": float(s),
#         })
#     return jsonify(results)

# if __name__ == "__main__":
#     print("🚀 Starting Flask server on http://127.0.0.1:5000 ...")
#     app.run(host="0.0.0.0", port=5000)

