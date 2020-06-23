export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec2 _uv;

uniform sampler2D matAoMap;

void main()
{   
  color = vec4(texture(matAoMap, _uv).rgb, 1.0f);
}
`;
