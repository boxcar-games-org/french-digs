const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "french-digs/_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.EnBNRQg4.js",app:"_app/immutable/entry/app.2Dx3KEnV.js",imports:["_app/immutable/entry/start.EnBNRQg4.js","_app/immutable/chunks/a76BV85z.js","_app/immutable/chunks/DvXauF-s.js","_app/immutable/chunks/BFPKPoRs.js","_app/immutable/entry/app.2Dx3KEnV.js","_app/immutable/chunks/DvXauF-s.js","_app/immutable/chunks/CjvPl5Bj.js","_app/immutable/chunks/Ccqtn9w_.js","_app/immutable/chunks/C1td_J-B.js","_app/immutable/chunks/BFPKPoRs.js","_app/immutable/chunks/CR6xT3SE.js","_app/immutable/chunks/CfBRWl2k.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-Bky7Mx7C.js')),
			__memo(() => import('./chunks/1-CjRYgGf4.js')),
			__memo(() => import('./chunks/2-CRmajsUH.js')),
			__memo(() => import('./chunks/3-CeomRLSz.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/game",
				pattern: /^\/game\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "/french-digs";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
