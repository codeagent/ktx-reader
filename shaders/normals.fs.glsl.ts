export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec2 _uv;

uniform sampler2D matNormalMap;

void main()
{   
  vec3 normal = texture(matNormalMap, _uv).rgb;
  color = vec4(vec3(normal), 1.0f);
}
`;
