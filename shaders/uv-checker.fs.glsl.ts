export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec2 _uv;

uniform sampler2D uvChecker;

void main()
{   
  vec3 albedo = texture(uvChecker, _uv).rgb;

  color = vec4(albedo, 1.0f);
}
`;
