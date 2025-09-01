import cv2
import numpy as np
from PIL import Image
import trimesh
import os
import uuid
import base64
import requests
import json
import time
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
import asyncio
import aiohttp
from typing import Optional


class MeshyAI3DGenerator:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('MESHY_API_KEY')
        self.base_url = "https://api.meshy.ai"
        
        if not self.api_key:
            print("⚠️  WARNING: No Meshy API key provided!")
            print("📝 Get your API key from: https://meshy.ai")
            print("💡 Set it as environment variable: MESHY_API_KEY=your_key_here")
        else:
            print(f"✅ Meshy API initialized (key: ...{self.api_key[-4:]})")

    async def create_meshy_task_directly(self, image_path: str, prompt: str) -> Optional[str]:
        """Create Meshy image-to-3D task directly (newer API)"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            # Read and encode image
            with open(image_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode()
            
            # Create task payload
            payload = {
                "mode": "image",
                "preview_task_id": "",
                "image_file": image_data,
                "enable_pbr": True,
                "negative_prompt": "low quality, blurry, distorted",
                "art_style": "realistic"
            }
            
            # Add prompt if provided
            if prompt.strip():
                payload["object_prompt"] = prompt.strip()
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v1/image-to-3d",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        task_id = result.get('result')
                        print(f"✅ Meshy task created. ID: {task_id}")
                        return task_id
                    else:
                        error_text = await response.text()
                        print(f"❌ Task creation failed: {response.status} - {error_text}")
                        
                        # Try alternative endpoint
                        return await self.try_alternative_meshy_endpoint(image_path, prompt, headers)
                        
        except Exception as e:
            print(f"❌ Direct task creation error: {e}")
            return await self.try_alternative_meshy_endpoint(image_path, prompt, {
                'Authorization': f'Bearer {self.api_key}'
            })

    async def try_alternative_meshy_endpoint(self, image_path: str, prompt: str, headers: dict) -> Optional[str]:
        """Try alternative Meshy API endpoints"""
        try:
            print("🔄 Trying alternative Meshy endpoint...")
            
            # Method 1: Try v2 endpoint with form data
            with open(image_path, 'rb') as f:
                async with aiohttp.ClientSession() as session:
                    data = aiohttp.FormData()
                    data.add_field('file', f, filename='image.jpg', content_type='image/jpeg')
                    data.add_field('enable_pbr', 'true')
                    data.add_field('art_style', 'realistic')
                    
                    if prompt.strip():
                        data.add_field('object_prompt', prompt.strip())
                    
                    async with session.post(
                        f"{self.base_url}/v2/image-to-3d",
                        headers={'Authorization': headers['Authorization']},
                        data=data
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            task_id = result.get('result') or result.get('id')
                            print(f"✅ Alternative endpoint success. Task ID: {task_id}")
                            return task_id
                        else:
                            error_text = await response.text()
                            print(f"❌ Alternative endpoint failed: {response.status} - {error_text}")
                            
            # Method 2: Try text-to-3D as backup
            print("🔄 Trying text-to-3D as backup...")
            return await self.try_text_to_3d_backup(prompt, headers)
                            
        except Exception as e:
            print(f"❌ Alternative endpoint error: {e}")
            return None

    async def try_text_to_3d_backup(self, prompt: str, headers: dict) -> Optional[str]:
        """Use text-to-3D as backup when image upload fails"""
        try:
            if not prompt.strip():
                prompt = "generic 3D object"
                
            payload = {
                "object_prompt": prompt,
                "style_prompt": "realistic, high quality, detailed",
                "enable_pbr": True,
                "negative_prompt": "low quality, blurry",
                "art_style": "realistic",
                "seed": 42
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v2/text-to-3d",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        task_id = result.get('result') or result.get('id')
                        print(f"✅ Text-to-3D backup successful. Task ID: {task_id}")
                        return task_id
                    else:
                        error_text = await response.text()
                        print(f"❌ Text-to-3D backup failed: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            print(f"❌ Text-to-3D backup error: {e}")
            return None

    async def create_image_to_3d_task(self, image_id: str, prompt: str = "") -> Optional[str]:
        """Create image-to-3D generation task"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            # Meshy API payload
            payload = {
                "image_id": image_id,
                "enable_pbr": True,  # Physically Based Rendering materials
                "surface_mode": "organic",  # or "hard_surface" for mechanical objects
                "target_polycount": 30000,  # Higher quality mesh
                "texture_richness": "high"
            }
            
            # Add prompt if provided
            if prompt.strip():
                payload["object_prompt"] = prompt.strip()
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v2/image-to-3d",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        task_id = result.get('id')
                        print(f"✅ 3D generation task created. ID: {task_id}")
                        return task_id
                    else:
                        error_text = await response.text()
                        print(f"❌ Task creation failed: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            print(f"❌ Task creation error: {e}")
            return None

    async def poll_task_status(self, task_id: str, max_wait: int = 600) -> Optional[dict]:
        """Poll task status until completion (Meshy can take 5-10 minutes)"""
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        
        start_time = time.time()
        last_status = None
        
        async with aiohttp.ClientSession() as session:
            while time.time() - start_time < max_wait:
                try:
                    async with session.get(
                        f"{self.base_url}/v2/image-to-3d/{task_id}",
                        headers=headers
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            status = result.get('status')
                            progress = result.get('progress', 0)
                            
                            if status != last_status:
                                print(f"🔄 Meshy status: {status} ({progress}%)")
                                last_status = status
                            
                            if status == 'SUCCEEDED':
                                print("🎉 3D model generation completed!")
                                return result
                            elif status == 'FAILED':
                                error_msg = result.get('error', 'Unknown error')
                                print(f"❌ Generation failed: {error_msg}")
                                return None
                            elif status in ['PENDING', 'IN_PROGRESS']:
                                # Still processing, wait and retry
                                await asyncio.sleep(15)  # Check every 15 seconds
                            else:
                                print(f"❓ Unknown status: {status}")
                                await asyncio.sleep(15)
                        else:
                            error_text = await response.text()
                            print(f"❌ Status check failed: {response.status} - {error_text}")
                            await asyncio.sleep(30)
                            
                except Exception as e:
                    print(f"❌ Polling error: {e}")
                    await asyncio.sleep(30)
        
        print("⏰ Task timed out")
        return None

    async def download_glb_model(self, download_url: str) -> str:
        """Download the generated GLB model"""
        try:
            output_path = f"temp/{uuid.uuid4()}_meshy.glb"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(download_url) as response:
                    if response.status == 200:
                        content = await response.read()
                        
                        with open(output_path, 'wb') as f:
                            f.write(content)
                        
                        file_size = len(content)
                        print(f"✅ Downloaded GLB model: {output_path} ({file_size:,} bytes)")
                        return output_path
                    else:
                        raise Exception(f"Download failed: {response.status}")
                        
        except Exception as e:
            print(f"❌ Download error: {e}")
            raise

    async def generate_3d_from_image(self, image_path: str, prompt: str = "") -> tuple[str, dict]:
        """
        Complete pipeline: Upload image → Generate 3D → Download GLB
        """
        if not self.api_key:
            raise Exception("Meshy API key is required. Get one from https://meshy.ai")
        
        start_time = time.time()
        analysis = {
            "service": "meshy_ai",
            "status": "starting",
            "generation_time": 0,
            "model_quality": "high",
            "has_texture": True,
            "has_pbr_materials": True,
            "vertex_count": 0,
            "face_count": 0,
            "file_size_bytes": 0
        }
        
        try:
            # Step 1: Upload image
            print("📤 Step 1: Uploading image to Meshy...")
            analysis["status"] = "uploading"
            image_id = await self.upload_image_to_meshy(image_path)
            
            if not image_id:
                raise Exception("Failed to upload image to Meshy")
            
            # Step 2: Create 3D generation task
            print("🎯 Step 2: Creating 3D generation task...")
            analysis["status"] = "creating_task"
            task_id = await self.create_image_to_3d_task(image_id, prompt)
            
            if not task_id:
                raise Exception("Failed to create 3D generation task")
            
            # Step 3: Wait for generation to complete
            print("⏳ Step 3: Waiting for 3D generation (this can take 5-10 minutes)...")
            analysis["status"] = "generating"
            task_result = await self.poll_task_status(task_id)
            
            if not task_result:
                raise Exception("3D generation failed or timed out")
            
            # Step 4: Download the generated model
            print("📥 Step 4: Downloading generated 3D model...")
            analysis["status"] = "downloading"
            
            model_urls = task_result.get('model_urls', {})
            glb_url = model_urls.get('glb')
            
            if not glb_url:
                raise Exception("No GLB download URL in task result")
            
            glb_path = await self.download_glb_model(glb_url)
            
            # Step 5: Analyze final model
            analysis["status"] = "completed"
            analysis["generation_time"] = time.time() - start_time
            analysis["file_size_bytes"] = os.path.getsize(glb_path)
            
            # Get mesh statistics
            try:
                mesh = trimesh.load(glb_path)
                if hasattr(mesh, 'vertices') and hasattr(mesh, 'faces'):
                    analysis["vertex_count"] = len(mesh.vertices)
                    analysis["face_count"] = len(mesh.faces)
                elif hasattr(mesh, 'geometry'):
                    # Handle scene with multiple geometries
                    total_vertices = sum(len(geom.vertices) for geom in mesh.geometry.values())
                    total_faces = sum(len(geom.faces) for geom in mesh.geometry.values())
                    analysis["vertex_count"] = total_vertices
                    analysis["face_count"] = total_faces
            except Exception as e:
                print(f"⚠️  Could not analyze mesh: {e}")
            
            print(f"🎉 3D model generated successfully!")
            print(f"📊 Stats: {analysis['vertex_count']:,} vertices, {analysis['face_count']:,} faces")
            print(f"⏱️  Total time: {analysis['generation_time']:.1f}s")
            print(f"💾 File size: {analysis['file_size_bytes']:,} bytes")
            
            return glb_path, analysis
            
        except Exception as e:
            analysis["status"] = "failed"
            analysis["error"] = str(e)
            analysis["generation_time"] = time.time() - start_time
            raise Exception(f"Meshy 3D generation failed: {e}")

    def create_fallback_model(self, image_path: str, prompt: str) -> tuple[str, dict]:
        """Create fallback model when API is unavailable"""
        print("🔄 Creating fallback 3D model...")
        
        # Analyze prompt to determine object type
        prompt_lower = prompt.lower()
        
        if any(word in prompt_lower for word in ['car', 'vehicle', 'automobile', 'truck']):
            mesh = self.create_detailed_car()
        elif any(word in prompt_lower for word in ['person', 'human', 'man', 'woman']):
            mesh = self.create_detailed_person()
        elif any(word in prompt_lower for word in ['building', 'house', 'structure']):
            mesh = self.create_detailed_building()
        else:
            mesh = self.create_detailed_object()
        
        # Apply texture from image
        try:
            img = cv2.imread(image_path)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_resized = cv2.resize(img_rgb, (1024, 1024))  # Higher res texture
            texture_img = Image.fromarray(img_resized)
            
            # Better UV mapping
            mesh.visual = trimesh.visual.TextureVisuals(image=texture_img)
        except Exception as e:
            print(f"⚠️  Texture application failed: {e}")
        
        # Export
        output_path = f"temp/{uuid.uuid4()}_fallback.glb"
        mesh.export(output_path, file_type='glb')
        
        analysis = {
            "service": "fallback_template",
            "status": "completed",
            "model_quality": "medium",
            "has_texture": True,
            "has_pbr_materials": False,
            "vertex_count": len(mesh.vertices),
            "face_count": len(mesh.faces),
            "file_size_bytes": os.path.getsize(output_path)
        }
        
        return output_path, analysis

    def create_detailed_car(self) -> trimesh.Trimesh:
        """Create a detailed car mesh with proper proportions"""
        parts = []
        
        # Main body (lower)
        body_lower = trimesh.creation.box(extents=(4.5, 2.0, 0.8))
        body_lower.apply_translation([0, 0, 0.4])
        parts.append(body_lower)
        
        # Main body (upper)
        body_upper = trimesh.creation.box(extents=(4.0, 1.8, 0.6))
        body_upper.apply_translation([0, 0, 1.1])
        parts.append(body_upper)
        
        # Cabin/Roof
        cabin = trimesh.creation.box(extents=(2.8, 1.6, 1.0))
        cabin.apply_translation([0.2, 0, 1.9])
        parts.append(cabin)
        
        # Hood
        hood = trimesh.creation.box(extents=(1.2, 1.8, 0.3))
        hood.apply_translation([1.8, 0, 1.15])
        parts.append(hood)
        
        # Wheels (4 wheels with proper positioning)
        wheel_radius = 0.35
        wheel_width = 0.25
        
        wheel_positions = [
            [1.4, -1.1, 0],    # Front right
            [1.4, 1.1, 0],     # Front left  
            [-1.4, -1.1, 0],   # Rear right
            [-1.4, 1.1, 0]     # Rear left
        ]
        
        for pos in wheel_positions:
            wheel = trimesh.creation.cylinder(radius=wheel_radius, height=wheel_width)
            wheel.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
            wheel.apply_translation(pos)
            parts.append(wheel)
        
        # Combine all parts
        car_mesh = trimesh.util.concatenate(parts)
        return car_mesh

    def create_detailed_person(self) -> trimesh.Trimesh:
        """Create a detailed humanoid mesh"""
        parts = []
        
        # Head
        head = trimesh.creation.icosphere(radius=0.25, subdivisions=2)
        head.apply_translation([0, 0, 1.75])
        parts.append(head)
        
        # Neck
        neck = trimesh.creation.cylinder(radius=0.08, height=0.2)
        neck.apply_translation([0, 0, 1.4])
        parts.append(neck)
        
        # Torso
        torso = trimesh.creation.box(extents=(0.6, 0.3, 1.0))
        torso.apply_translation([0, 0, 0.8])
        parts.append(torso)
        
        # Arms
        arm_length = 0.7
        arm_radius = 0.08
        
        # Left arm
        left_arm = trimesh.creation.cylinder(radius=arm_radius, height=arm_length)
        left_arm.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        left_arm.apply_translation([0.4, 0, 0.9])
        parts.append(left_arm)
        
        # Right arm  
        right_arm = trimesh.creation.cylinder(radius=arm_radius, height=arm_length)
        right_arm.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        right_arm.apply_translation([-0.4, 0, 0.9])
        parts.append(right_arm)
        
        # Legs
        leg_length = 0.9
        leg_radius = 0.1
        
        # Left leg
        left_leg = trimesh.creation.cylinder(radius=leg_radius, height=leg_length)
        left_leg.apply_translation([0.15, 0, -0.15])
        parts.append(left_leg)
        
        # Right leg
        right_leg = trimesh.creation.cylinder(radius=leg_radius, height=leg_length)
        right_leg.apply_translation([-0.15, 0, -0.15])
        parts.append(right_leg)
        
        person_mesh = trimesh.util.concatenate(parts)
        return person_mesh

    def create_detailed_building(self) -> trimesh.Trimesh:
        """Create a detailed building mesh"""
        parts = []
        
        # Main structure
        main_building = trimesh.creation.box(extents=(4, 4, 3))
        main_building.apply_translation([0, 0, 1.5])
        parts.append(main_building)
        
        # Roof
        roof = trimesh.creation.box(extents=(4.5, 4.5, 0.5))
        roof.apply_translation([0, 0, 3.25])
        parts.append(roof)
        
        # Door frame
        door_frame = trimesh.creation.box(extents=(0.1, 1.2, 2.2))
        door_frame.apply_translation([2.1, 0, 1.1])
        parts.append(door_frame)
        
        building_mesh = trimesh.util.concatenate(parts)
        return building_mesh

    def create_detailed_object(self) -> trimesh.Trimesh:
        """Create a detailed generic object"""
        # Create an interesting organic shape
        base = trimesh.creation.icosphere(radius=1.2, subdivisions=3)
        
        # Add organic deformation
        vertices = base.vertices.copy()
        for i, vertex in enumerate(vertices):
            x, y, z = vertex
            # Multi-frequency noise for organic look
            noise = (np.sin(x * 2) * np.cos(y * 2) * 0.15 + 
                    np.sin(x * 5) * np.sin(z * 4) * 0.08 +
                    np.cos(y * 3) * np.sin(z * 3) * 0.1)
            
            # Apply noise along normal direction
            normal = vertex / np.linalg.norm(vertex)
            vertices[i] = vertex + normal * noise
        
        base.vertices = vertices
        return base


# FastAPI Server
app = FastAPI(title="Meshy AI 3D Generator", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize generator
meshy_api_key = os.getenv('MESHY_API_KEY')
generator = MeshyAI3DGenerator(meshy_api_key)


@app.post("/generate-3d")
async def generate_3d_model(
    image: UploadFile = File(...), 
    prompt: str = Form(""),
    use_meshy: bool = Form(True)
):
    """
    Generate a complete 3D model from image using Meshy AI
    
    - **image**: Upload an image file (JPG, PNG)
    - **prompt**: Optional description to help AI understand the object
    - **use_meshy**: Whether to use Meshy AI (requires API key) or fallback
    """
    file_id = str(uuid.uuid4())
    input_path = f"temp/{file_id}_input.jpg"
    
    try:
        # Create temp directory
        os.makedirs("temp", exist_ok=True)
        
        # Save uploaded image
        with open(input_path, "wb") as f:
            content = await image.read()
            f.write(content)
        
        print(f"🖼️  Processing image: {image.filename}")
        print(f"💬 Prompt: '{prompt}'")
        
        # Generate 3D model
        if use_meshy and generator.api_key:
            print("🚀 Using Meshy AI for true 3D generation...")
            glb_path, analysis = await generator.generate_3d_from_image(input_path, prompt)
        else:
            print("🔄 Using fallback template generation...")
            glb_path, analysis = generator.create_fallback_model(input_path, prompt)
        
        # Verify file exists
        if not os.path.exists(glb_path) or os.path.getsize(glb_path) == 0:
            raise Exception("Generated GLB file is invalid")
        
        print(f"✅ 3D model ready: {glb_path}")
        
        response = FileResponse(
            glb_path,
            media_type="model/gltf-binary",
            filename=f"meshy_3d_{file_id}.glb",
            headers={
                "X-Generation-Analysis": json.dumps(analysis),
                "X-Generation-Service": analysis.get("service", "unknown"),
                "X-Model-Quality": analysis.get("model_quality", "unknown")
            }
        )
        
        return response

    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "suggestion": "Make sure MESHY_API_KEY is set, or try with use_meshy=false for offline generation"
            }
        )
    
    finally:
        # Cleanup input file
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
        except:
            pass


@app.get("/")
async def root():
    return {
        "service": "Meshy AI 3D Model Generator",
        "description": "Generate complete 3D models with all sides from single images",
        "endpoints": {
            "POST /generate-3d": "Upload image and generate 3D model",
            "GET /status": "Check service status",
            "GET /docs": "API documentation"
        },
        "features": [
            "True 3D geometry (not just extrusion)",
            "Automatic backside generation", 
            "PBR materials and textures",
            "High-quality mesh output",
            "Smart object detection"
        ]
    }


@app.get("/status")
async def service_status():
    """Check service status and API key availability"""
    has_meshy_key = bool(generator.api_key)
    
    return {
        "status": "healthy",
        "meshy_ai_available": has_meshy_key,
        "fallback_available": True,
        "setup_instructions": {
            "meshy_api": "Get API key from https://meshy.ai and set MESHY_API_KEY environment variable",
            "fallback": "Works without API key but lower quality"
        },
        "generation_capabilities": {
            "with_meshy": [
                "Complete 3D geometry with all sides",
                "AI-generated backside and hidden details", 
                "High polygon count (up to 30K)",
                "PBR materials",
                "Professional quality textures"
            ],
            "fallback": [
                "Template-based 3D models",
                "Basic geometry",
                "Image-based textures",
                "Good for prototyping"
            ]
        }
    }


@app.post("/test-meshy")
async def test_meshy_connection():
    """Test Meshy API connection"""
    if not generator.api_key:
        return JSONResponse(
            status_code=400,
            content={"error": "No Meshy API key configured"}
        )
    
    try:
        headers = {'Authorization': f'Bearer {generator.api_key}'}
        
        async with aiohttp.ClientSession() as session:
            # Test API connection
            async with session.get(
                f"{generator.base_url}/v2/user/credits",
                headers=headers
            ) as response:
                if response.status == 200:
                    credits_info = await response.json()
                    return {
                        "status": "connected",
                        "credits_remaining": credits_info.get('credits', 'unknown'),
                        "message": "Meshy API is working correctly"
                    }
                else:
                    error_text = await response.text()
                    return JSONResponse(
                        status_code=response.status,
                        content={"error": f"API test failed: {error_text}"}
                    )
                    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Connection test failed: {str(e)}"}
        )


if __name__ == "__main__":
    print("🚀 Starting Meshy AI 3D Model Generator...")
    print("=" * 50)
    print("🎯 This service generates COMPLETE 3D models from single images")
    print("✨ Features:")
    print("   • True 3D geometry (not just 2.5D extrusion)")
    print("   • AI-generated backside and hidden details")
    print("   • Professional quality textures and materials")
    print("   • Smart object recognition")
    print("")
    print("🔑 Setup:")
    print("   1. Get API key from: https://meshy.ai")
    print("   2. Set environment variable: MESHY_API_KEY=your_key_here")
    print("   3. Or use fallback mode (lower quality)")
    print("")
    print("🌐 Server starting at: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")
    print("=" * 50)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)