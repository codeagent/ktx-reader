export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec2 _uv;

uniform float matMetallic;
uniform sampler2D matMetallicMap;

void main()
{   
  float metallic = texture(matMetallicMap, _uv).r * matMetallic;
  color = vec4(vec3(metallic), 1.0f);
}
`;
