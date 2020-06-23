export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec2 _uv;

uniform float matRoughness;
uniform sampler2D matRouhnessMap;

void main()
{   
  float roughness = texture(matRouhnessMap, _uv).r * matRoughness;
  color = vec4(vec3(roughness), 1.0f);
}
`;
