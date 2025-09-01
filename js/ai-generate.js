// ai-generate.js
import { GoogleGenerativeAI } from '@google/generative-ai';

class AITransformer {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI('AIzaSyDSLm3n_5DbAm5JudMJ4j_neNy3bhEifh0');
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async getTransformationInstructions(prompt, currentObject) {
    try {
      const objectInfo = {
        type: currentObject.type,
        name: currentObject.name,
        position: {
          x: currentObject.position.x,
          y: currentObject.position.y,
          z: currentObject.position.z
        },
        scale: {
          x: currentObject.scale.x,
          y: currentObject.scale.y,
          z: currentObject.scale.z
        },
        rotation: {
          x: currentObject.rotation.x,
          y: currentObject.rotation.y,
          z: currentObject.rotation.z
        },
        material: currentObject.material ? currentObject.material.type : 'unknown'
      };

      const result = await this.model.generateContent(`
        Analyze this 3D object and provide transformation instructions based on the user prompt.
        
        CURRENT OBJECT:
        ${JSON.stringify(objectInfo, null, 2)}
        
        USER PROMPT: "${prompt}"
        
        Respond with ONLY a JSON object in this exact format:
        {
          "transformations": [
            {
              "type": "color" | "scale" | "position" | "rotation" | "material",
              "value": appropriate value based on type,
              "description": "brief description of the change"
            }
          ]
        }
        
        For color: use hex string like "#3498db"
        For scale/position/rotation: use {x: number, y: number, z: number} or single number for uniform scaling
        For material: use "basic", "standard", or "physical"
        
        Only include transformations that make sense for the prompt.
      `);

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid transformation instructions found in the response");
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("AI Transformation Error:", error);
      throw error;
    }
  }

  applyTransformations(object, transformations) {
    transformations.forEach(transformation => {
      try {
        switch (transformation.type) {
          case 'color':
            this.applyColorChange(object, transformation.value);
            break;
          case 'scale':
            this.applyScaleChange(object, transformation.value);
            break;
          case 'position':
            this.applyPositionChange(object, transformation.value);
            break;
          case 'rotation':
            this.applyRotationChange(object, transformation.value);
            break;
          case 'material':
            this.applyMaterialChange(object, transformation.value);
            break;
        }
        console.log(`Applied ${transformation.type}: ${transformation.description}`);
      } catch (error) {
        console.error(`Failed to apply ${transformation.type} transformation:`, error);
      }
    });
  }

  applyColorChange(object, colorHex) {
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat.color) {
            mat.color.set(colorHex);
          }
        });
      } else if (object.material.color) {
        object.material.color.set(colorHex);
      }
    }
  }

  applyScaleChange(object, scale) {
    if (typeof scale === 'number') {
      object.scale.set(scale, scale, scale);
    } else if (typeof scale === 'object') {
      object.scale.set(
        scale.x || object.scale.x,
        scale.y || object.scale.y,
        scale.z || object.scale.z
      );
    }
  }

  applyPositionChange(object, position) {
    if (typeof position === 'object') {
      object.position.set(
        position.x || object.position.x,
        position.y || object.position.y,
        position.z || object.position.z
      );
    }
  }

  applyRotationChange(object, rotation) {
    if (typeof rotation === 'object') {
      object.rotation.set(
        rotation.x || object.rotation.x,
        rotation.y || object.rotation.y,
        rotation.z || object.rotation.z
      );
    }
  }

  applyMaterialChange(object, materialType) {
    if (!object.material) return;

    const currentMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
    let newMaterial;

    switch (materialType.toLowerCase()) {
      case 'standard':
        newMaterial = new THREE.MeshStandardMaterial({
          color: currentMaterial.color ? currentMaterial.color.clone() : 0xffffff
        });
        break;
      case 'physical':
        newMaterial = new THREE.MeshPhysicalMaterial({
          color: currentMaterial.color ? currentMaterial.color.clone() : 0xffffff
        });
        break;
      case 'basic':
      default:
        newMaterial = new THREE.MeshBasicMaterial({
          color: currentMaterial.color ? currentMaterial.color.clone() : 0xffffff
        });
        break;
    }

    if (Array.isArray(object.material)) {
      object.material = object.material.map(() => newMaterial.clone());
    } else {
      object.material = newMaterial;
    }
  }
}

export { AITransformer };