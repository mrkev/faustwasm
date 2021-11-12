//@ts-check
/**
 * @typedef {import("./types").FaustDspDistribution} FaustDspDistribution
 * @typedef {import("./types").FaustDspMeta} FaustDspMeta
 * @typedef {import("./types").FaustUIDescriptor} FaustUIDescriptor
 * @typedef {import("./types").IFaustUIGroup} IFaustUIGroup
 * @typedef {import("./types").IFaustUIItem} IFaustUIItem
 */

import WebAudioModule from './sdk/src/WebAudioModule.js';
import addFunctionModule from "./sdk/src/addFunctionModule.js"
import getFaustProcessor from "./FaustProcessor.js"
import FaustNode from "./FaustNode.js"
import CompositeAudioNode from './sdk-parammgr/src/CompositeAudioNode.js';
import ParamMgrFactory from './sdk-parammgr/src/ParamMgrFactory.js';
import createElement from './gui.js';
import fetchModule from './fetchModule.js';

/**
 * @typedef {import('./sdk-parammgr/src/ParamMgrNode.js').default} ParamMgrNode
 */

class FaustCompositeAudioNode extends CompositeAudioNode {
	/**
	 * @type {ParamMgrNode}
	 */
	_wamNode;

	/**
	 * @param {AudioWorkletNode} output
	 * @param {ParamMgrNode} paramMgr
	 */
	setup(output, paramMgr) {
		this.connect(output, 0, 0);
		paramMgr.addEventListener('wam-midi', (e) => output.midiMessage(e.detail.data.bytes));
		this._wamNode = paramMgr;
		this._output = output;
	}

	destroy() {
		super.destroy();
		if (this._output) this._output.destroy();
	}

	/**
	 * @param {string} name
	 */
	getParamValue(name) {
		return this._wamNode.getParamValue(name);
	}

	/**
	 * @param {string} name
	 * @param {number} value
	 */
	setParamValue(name, value) {
		return this._wamNode.setParamValue(name, value);
	}
}

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
	const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf('/'));
	return baseURL;
};

export default class FaustPingPongDelayPlugin extends WebAudioModule {
	/**
	 * Faust generated WebAudio AudioWorkletNode Constructor
	 */
	_PluginFactory;

	_baseURL = getBasetUrl(new URL('.', import.meta.url));

	_descriptorUrl = `${this._baseURL}/descriptor.json`;

	async _loadDescriptor() {
		const url = this._descriptorUrl;
		if (!url) throw new TypeError('Descriptor not found');
		const response = await fetch(url);
		const descriptor = await response.json();
		Object.assign(this.descriptor, descriptor);
	}

	async initialize(state) {
		await this._loadDescriptor();
		return super.initialize(state);
	}

	async createAudioNode(initialState) {
		const dspMeta = await (await fetch(`${this._baseURL}/dspMeta.json`)).json();
		const dspModule = await WebAssembly.compileStreaming(await fetch(`${this._baseURL}/dspModule.wasm`));
		/** @type {FaustDspDistribution} */
		const faustDsp = { dspMeta, dspModule };
		try {
			faustDsp.effectMeta = await (await fetch(`${this._baseURL}/effectMeta.json`)).json();
			faustDsp.effectModule = await WebAssembly.compileStreaming(await fetch(`${this._baseURL}/effectModule.wasm`));
			faustDsp.mixerModule = await WebAssembly.compileStreaming(await fetch(`${this._baseURL}/mixerModule.wasm`));
		} catch (error) {}
		await addFunctionModule(this.audioContext.audioWorklet, getFaustProcessor, this.moduleId + "Faust", 0, dspMeta, faustDsp.effectMeta);
		const faustNode = new FaustNode(this.audioContext, this.moduleId + "Faust", faustDsp, 0);
		const paramMgrNode = await ParamMgrFactory.create(this, { internalParamsConfig: Object.fromEntries(faustNode.parameters) });
		const node = new FaustCompositeAudioNode(this.audioContext);
		node.setup(faustNode, paramMgrNode);
		if (initialState) node.setState(initialState);
		return node;
	}

	createGui() {
		return createElement(this);
	}
}
