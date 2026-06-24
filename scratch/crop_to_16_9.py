import sys
from PIL import Image

def crop_to_16_9(image_path, output_path):
    print(f"Opening image: {image_path}")
    img = Image.open(image_path)
    width, height = img.size
    print(f"Original size: {width}x{height} (Aspect ratio: {width/height:.4f})")
    
    target_ratio = 16.0 / 9.0
    current_ratio = width / height
    
    if abs(current_ratio - target_ratio) < 0.0001:
        print("Image is already 16:9. Just saving/copying...")
        img.save(output_path, "PNG")
        return
        
    if current_ratio > target_ratio:
        # Image is too wide, crop left/right
        new_width = int(height * target_ratio)
        left = (width - new_width) // 2
        right = left + new_width
        top = 0
        bottom = height
        print(f"Cropping left/right: new width {new_width}, crop left: {left}, right: {right}")
    else:
        # Image is too tall, crop top/bottom
        new_height = int(width / target_ratio)
        top = (height - new_height) // 2
        bottom = top + new_height
        left = 0
        right = width
        print(f"Cropping top/bottom: new height {new_height}, crop top: {top}, bottom: {bottom}")
        
    cropped_img = img.crop((left, top, right, bottom))
    print(f"Cropping completed. New size: {cropped_img.size} (Aspect ratio: {cropped_img.width/cropped_img.height:.4f})")
    cropped_img.save(output_path, "PNG")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    crop_to_16_9(
        "C:\\Users\\Warp Gate\\Documents\\IDL_SkillEnhancement\\Zenith_bg_LGM2.png",
        "C:\\Users\\Warp Gate\\Documents\\IDL_SkillEnhancement\\public\\Zenith_bg_LGM2.png"
    )
