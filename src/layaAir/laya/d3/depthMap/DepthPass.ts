import { LayaGL } from "../../layagl/LayaGL";
import { RenderTextureDepthFormat, RenderTextureFormat } from "../../resource/RenderTextureFormat";
import { BaseCamera } from "../core/BaseCamera";
import { Camera, DepthTextureMode } from "../core/Camera";
import { RenderContext3D } from "../core/render/RenderContext3D";
import { Vector4 } from "../math/Vector4";
import { Viewport } from "../math/Viewport";
import { RenderTexture } from "../resource/RenderTexture";
import { ShaderData } from "../shader/ShaderData";
import { ShadowCasterPass } from "../shadowMap/ShadowCasterPass";

/**
 * @internal
 * <code>ShadowCasterPass</code> 类用于实现阴影渲染管线
 */
export class DepthPass {
	private static SHADOW_BIAS:Vector4 = new Vector4();
	/**@internal */
	private _depthTexture:RenderTexture;
	/**@internal */
	private _depthNormalsTexture:RenderTexture;
	/**@internal */
	private _viewPort:Viewport;
	/**@internal */
	private _camera:Camera;
	
	// Values used to linearize the Z buffer (http://www.humus.name/temp/Linearize%20depth.txt)
    // x = 1-far/near
    // y = far/near
    // z = x/far
    // w = y/far
    // or in case of a reversed depth buffer (UNITY_REVERSED_Z is 1)
    // x = -1+far/near
    // y = 1
    // z = x/far
	// w = 1/far
	/**@internal */
	private _zBufferParams:Vector4 = new Vector4();

	constructor() {
	}

	/**
	 * 渲染深度更新
	 * @param camera 
	 * @param depthType 
	 */
	update(camera: Camera,depthType:DepthTextureMode): void {
		this._viewPort = camera.viewport;
		this._camera = camera;
		switch(depthType){
			case DepthTextureMode.Depth:
				camera.depthTexture = this._depthTexture = RenderTexture.createFromPool(this._viewPort.width, this._viewPort.height,RenderTextureFormat.Depth,RenderTextureDepthFormat.DEPTH_16);
				break;
			case DepthTextureMode.DepthNormals:
				camera.depthNormalTexture = this._depthNormalsTexture = RenderTexture.createFromPool(this._viewPort.width,this._viewPort.height,RenderTextureFormat.R8G8B8A8,RenderTextureDepthFormat.DEPTH_16);
				break;
			case DepthTextureMode.MotionVectors:
				//TODO：
				break;
			default:
				throw("there is UnDefined type of DepthTextureMode")
		}
	}

	/**
	 * 渲染深度帧缓存
	 * @param context 
	 * @param depthType 
	 */
	render(context: RenderContext3D,depthType:DepthTextureMode): void {
		var scene = context.scene;
		switch(depthType){
			case DepthTextureMode.Depth:
				var shaderValues:ShaderData = scene._shaderValues;
				context.pipelineMode = "ShadowCaster";
				ShaderData.setRuntimeValueMode(false);
				this._depthTexture._start();
				shaderValues.setVector(ShadowCasterPass.SHADOW_BIAS,DepthPass.SHADOW_BIAS);
				var gl = LayaGL.instance;
				var offsetX: number = this._viewPort.x;
				var offsetY: number = this._viewPort.y;
				gl.enable(gl.SCISSOR_TEST);
				gl.viewport(offsetX, offsetY, this._viewPort.width,this._viewPort.height);
				gl.scissor(offsetX, offsetY, this._viewPort.width,this._viewPort.height);
				gl.clear(gl.DEPTH_BUFFER_BIT);
				scene._opaqueQueue._render(context);
				this._depthTexture._end();
				ShaderData.setRuntimeValueMode(true);
				this._setupDepthModeShaderValue(depthType,this._camera);
				context.pipelineMode = context.configPipeLineMode;
				break;
			case DepthTextureMode.DepthNormals:
				var shaderValues:ShaderData = scene._shaderValues;
				context.pipelineMode = "DepthNormal";
				ShaderData.setRuntimeValueMode(false);
				this._depthNormalsTexture._start();
				//传入shader该传的值
				var gl = LayaGL.instance;
				var offsetX: number = this._viewPort.x;
				var offsetY: number = this._viewPort.y;
				gl.enable(gl.SCISSOR_TEST);
				gl.viewport(offsetX, offsetY, this._viewPort.width,this._viewPort.height);
				gl.scissor(offsetX, offsetY, this._viewPort.width,this._viewPort.height);
				gl.clearColor(1.0,1.0,1.0,1.0);
				gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT);
				scene._opaqueQueue._render(context);
				this._depthNormalsTexture._end();
				ShaderData.setRuntimeValueMode(true);
				this._setupDepthModeShaderValue(depthType,this._camera);
				context.pipelineMode = context.configPipeLineMode;
				break;
			case DepthTextureMode.MotionVectors:

				break;
			default:
				throw("there is UnDefined type of DepthTextureMode")
		}
	}

	/**
	 * 渲染完后传入使用的参数
	 * @internal
	 */
	private _setupDepthModeShaderValue(depthType:DepthTextureMode,camera:Camera){
		switch(depthType){
			case DepthTextureMode.Depth:
				var far = camera.farPlane;
				var near = camera.nearPlane;
				this._zBufferParams.setValue(1.0-far/near,far/near,(near-far)/(near*far),1/near);
				camera._shaderValues.setVector(ShadowCasterPass.SHADOW_BIAS,DepthPass.SHADOW_BIAS);
				camera._shaderValues.setTexture(BaseCamera.DEPTHTEXTURE,this._depthTexture);
				camera._shaderValues.setVector(BaseCamera.DEPTHZBUFFERPARAMS,this._zBufferParams);
				break;
			case DepthTextureMode.DepthNormals:
				camera._shaderValues.setTexture(BaseCamera.DEPTHNORMALSTEXTURE,this._depthNormalsTexture);
				break;
			case DepthTextureMode.MotionVectors:

				break;
			default:
				throw("there is UnDefined type of DepthTextureMode")
			}
	}

	/**
	 * 清理深度数据
	 * @internal
	 */
	cleanUp(): void {
		this._depthTexture && RenderTexture.recoverToPool(this._depthTexture);
		this._depthNormalsTexture && RenderTexture.recoverToPool(this._depthNormalsTexture);
		this._depthTexture = null;
		this._depthNormalsTexture = null;	
	}
}
